// src/ai/availability/availabilityService.ts

import prisma from "../../config/db";

export interface TimeSlot {
  start: Date;
  end: Date;
}

const APPOINTMENT_STATUSES_BLOCKING = ["PENDING", "CONFIRMED", "MOVED", "URGENT"];
const DEFAULT_SLOT_DURATION_MINUTES = 30;

/**
 * Retrouve un médecin par son nom (approximatif), pour matcher ce que
 * l'entityExtractor a extrait d'un message patient (ex: "Dr Ben Salah").
 * Ne renvoie que les utilisateurs avec role = 'DOCTOR'.
 */
export async function findDoctorByName(nameQuery: string) {
  const cleaned = nameQuery.replace(/^dr\.?\s*/i, "").trim();

  const doctor = await prisma.user.findFirst({
    where: {
      role: "DOCTOR",
      name: { contains: cleaned },
    },
  });

  return doctor;
}

/**
 * Calcule les fenêtres de disponibilité brutes d'un médecin pour une date donnée,
 * en combinant les règles récurrentes (dayOfWeek) et les exceptions (specificDate).
 * Une exception avec isAvailable=false sur toute la journée bloque tout le dayOfWeek ce jour-là.
 */
async function getAvailabilityWindows(doctorId: number, date: Date): Promise<TimeSlot[]> {
  const dayOfWeek = date.getDay();
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const rules = await prisma.doctorAvailability.findMany({
    where: {
      doctorId,
      OR: [
        { specificDate: { gte: dayStart, lte: dayEnd } },
        { AND: [{ dayOfWeek }, { specificDate: null }] },
      ],
    },
  });

  // Les exceptions (specificDate) priment sur la règle récurrente du même jour
  const hasSpecificOverride = rules.some((r) => r.specificDate !== null);
  const applicableRules = hasSpecificOverride
    ? rules.filter((r) => r.specificDate !== null)
    : rules.filter((r) => r.specificDate === null);

  const windows: TimeSlot[] = [];

  for (const rule of applicableRules) {
    if (!rule.isAvailable) continue; // règle de blocage (congé, pause) : pas une fenêtre ouverte

    windows.push({
      start: combineDateAndTime(date, rule.startTime),
      end: combineDateAndTime(date, rule.endTime),
    });
  }

  return windows;
}

/**
 * Récupère les rendez-vous déjà pris pour un médecin sur une journée donnée
 * (statuts qui bloquent réellement le créneau).
 */
async function getBookedSlots(doctorId: number, date: Date): Promise<TimeSlot[]> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: { in: APPOINTMENT_STATUSES_BLOCKING },
      startTime: { gte: dayStart, lte: dayEnd },
    },
    select: { startTime: true, endTime: true },
  });

  return appointments.map((a) => ({ start: a.startTime, end: a.endTime }));
}

/**
 * Retourne la liste des créneaux libres pour un médecin sur une date donnée,
 * en soustrayant les rendez-vous déjà pris des fenêtres de disponibilité.
 */
export async function getAvailableSlots(
  doctorId: number,
  date: Date,
  durationMinutes: number = DEFAULT_SLOT_DURATION_MINUTES
): Promise<TimeSlot[]> {
  const windows = await getAvailabilityWindows(doctorId, date);
  const booked = await getBookedSlots(doctorId, date);

  const freeSlots: TimeSlot[] = [];

  for (const window of windows) {
    let cursor = new Date(window.start);

    while (addMinutes(cursor, durationMinutes) <= window.end) {
      const slotEnd = addMinutes(cursor, durationMinutes);
      const overlapsBooked = booked.some(
        (b) => cursor < b.end && slotEnd > b.start
      );

      if (!overlapsBooked) {
        freeSlots.push({ start: new Date(cursor), end: slotEnd });
      }

      cursor = slotEnd;
    }
  }

  return freeSlots;
}

/**
 * Vérifie si un créneau précis demandé par un patient (date+heure exactes)
 * est réellement disponible avant de créer le rendez-vous.
 */
export async function isSlotAvailable(
  doctorId: number,
  requestedStart: Date,
  durationMinutes: number = DEFAULT_SLOT_DURATION_MINUTES
): Promise<boolean> {
  const requestedEnd = addMinutes(requestedStart, durationMinutes);
  const windows = await getAvailabilityWindows(doctorId, requestedStart);

  const withinWindow = windows.some(
    (w) => requestedStart >= w.start && requestedEnd <= w.end
  );
  if (!withinWindow) return false;

  const booked = await getBookedSlots(doctorId, requestedStart);
  const overlapsBooked = booked.some(
    (b) => requestedStart < b.end && requestedEnd > b.start
  );

  return !overlapsBooked;
}

// --- Helpers internes ---

function combineDateAndTime(date: Date, timeHHMM: string): Date {
  const [hours, minutes] = timeHHMM.split(":").map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}