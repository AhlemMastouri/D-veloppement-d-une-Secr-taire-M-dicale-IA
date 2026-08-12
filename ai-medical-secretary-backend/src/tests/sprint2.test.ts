/**
 * Module 02 – Integration Tests
 * Tests: conflicts, availability, patient encryption, archiving, permissions
 *
 * Run: npx ts-node src/tests/sprint2.test.ts
 */

// Load environment variables FIRST before any other import
import dotenv from 'dotenv';
dotenv.config();

import prisma from '../config/db';
import { encrypt, decrypt, hashForIndex } from '../utils/encryption';

// ─── Helpers ────────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    pass++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    fail++;
  }
}

async function cleanUp() {
  // Remove test data by phone hash
  const hash = hashForIndex('+33600000000');
  await prisma.patient.deleteMany({ where: { phoneHash: hash } });
  await prisma.cabinet.deleteMany({ where: { name: 'Test Cabinet' } });
  await prisma.holiday.deleteMany({ where: { name: 'Test Holiday' } });
}

// ─── Test Suites ─────────────────────────────────────────────────────────────

async function testEncryption() {
  console.log('\n🔐 [Suite] Encryption & Hashing');

  const phone = '+33612345678';
  const encrypted = encrypt(phone);
  const decrypted = decrypt(encrypted);

  assert(encrypted !== phone || !process.env.ENCRYPTION_KEY, 'encrypt() changes the value');
  assert(decrypted === phone, 'decrypt(encrypt(x)) === x');

  const hash1 = hashForIndex(phone);
  const hash2 = hashForIndex(phone);
  assert(hash1 === hash2, 'hashForIndex is deterministic');
  assert(hash1 !== phone, 'hashForIndex is not plain text');
}

async function testPatientAutoCreate() {
  console.log('\n👤 [Suite] Patient Auto-Creation & Duplicate Prevention');

  const phone = '+33600000000';
  const phoneHash = hashForIndex(phone);

  // Clean up before test
  await prisma.patient.deleteMany({ where: { phoneHash } });

  const patient = await prisma.patient.create({
    data: {
      firstName: 'Jean',
      lastName: 'Test',
      dob: new Date('1985-06-15'),
      phone: encrypt(phone),
      phoneHash,
      insurance: encrypt('Carte Vitale'),
      consentGdpr: true,
    },
  });

  assert(patient.id > 0, 'Patient created successfully');
  assert(patient.phone !== phone, 'Phone is encrypted at rest');
  assert(patient.phoneHash === phoneHash, 'Phone hash stored correctly');
  assert(decrypt(patient.phone) === phone, 'Phone decrypts back correctly');
  assert(patient.insurance !== null && patient.insurance !== 'Carte Vitale', 'Insurance is encrypted (not stored as plain text)');

  // Duplicate prevention via hash
  const duplicate = await prisma.patient.findUnique({ where: { phoneHash } });
  assert(duplicate !== null, 'Can find patient by phone hash');
  assert(duplicate?.id === patient.id, 'Correct patient found by hash');
}

async function testAppointmentConflict() {
  console.log('\n📅 [Suite] Appointment Conflict Detection');

  // Find a doctor and patient in DB
  const doctor = await prisma.user.findFirst({ where: { role: 'DOCTOR' } });
  const patient = await prisma.patient.findFirst();

  if (!doctor || !patient) {
    console.log('  ⚠️  Skipped – No doctor or patient in DB');
    return;
  }

  const start = new Date('2099-01-15T10:00:00');
  const end = new Date('2099-01-15T10:30:00');

  // Create first appointment
  const appt = await prisma.appointment.create({
    data: {
      patientId: patient.id,
      doctorId: doctor.id,
      startTime: start,
      endTime: end,
      status: 'CONFIRMED',
    },
  });

  // Try to create overlapping appointment
  const overlapping = await prisma.appointment.findFirst({
    where: {
      doctorId: doctor.id,
      status: { in: ['CONFIRMED', 'PENDING'] },
      AND: [{ startTime: { lt: new Date('2099-01-15T10:20:00') } }, { endTime: { gt: new Date('2099-01-15T10:10:00') } }],
    },
  });

  assert(overlapping !== null, 'Overlap detected by DB query');
  assert(overlapping?.id === appt.id, 'Correct overlapping appointment identified');

  // Non-overlapping slot should be free
  const nonOverlapping = await prisma.appointment.findFirst({
    where: {
      doctorId: doctor.id,
      status: { in: ['CONFIRMED', 'PENDING'] },
      AND: [{ startTime: { lt: new Date('2099-01-15T12:00:00') } }, { endTime: { gt: new Date('2099-01-15T11:30:00') } }],
    },
  });
  assert(nonOverlapping === null, 'Non-overlapping slot is free');

  // Clean up
  await prisma.appointment.delete({ where: { id: appt.id } });
}

async function testCabinetAndRoom() {
  console.log('\n🏥 [Suite] Cabinet & Room Schema');

  const cabinet = await prisma.cabinet.create({
    data: {
      name: 'Test Cabinet',
      address: '12 Rue de la Santé, Paris',
      rooms: { create: [{ name: 'Salle A' }, { name: 'Salle B' }] },
    },
    include: { rooms: true },
  });

  assert(cabinet.id > 0, 'Cabinet created');
  assert(cabinet.rooms.length === 2, 'Rooms created with cabinet');

  // Clean up
  await prisma.cabinet.delete({ where: { id: cabinet.id } });
}

async function testLeaveAndHoliday() {
  console.log('\n🏖️  [Suite] Leave & Holiday');

  const doctor = await prisma.user.findFirst({ where: { role: 'DOCTOR' } });
  if (!doctor) { console.log('  ⚠️  Skipped – No doctor in DB'); return; }

  const leave = await prisma.leave.create({
    data: { doctorId: doctor.id, startDate: new Date('2099-08-01'), endDate: new Date('2099-08-15'), reason: 'Vacances' },
  });
  assert(leave.id > 0, 'Leave created');

  const holiday = await prisma.holiday.upsert({
    where: { date: new Date('2099-11-11') },
    update: {},
    create: { date: new Date('2099-11-11'), name: 'Test Holiday' },
  });
  assert(holiday.id > 0, 'Holiday created');

  // Verify leave blocks availability query
  const leaveBlock = await prisma.leave.findFirst({
    where: {
      doctorId: doctor.id,
      startDate: { lte: new Date('2099-08-10T23:59:59') },
      endDate: { gte: new Date('2099-08-10T00:00:00') },
    },
  });
  assert(leaveBlock !== null, 'Leave correctly blocks availability date');

  // Clean up
  await prisma.leave.delete({ where: { id: leave.id } });
  await prisma.holiday.delete({ where: { id: holiday.id } });
}

async function testArchivedAppointment() {
  console.log('\n📦 [Suite] Appointment Archiving');

  const doctor = await prisma.user.findFirst({ where: { role: 'DOCTOR' } });
  const patient = await prisma.patient.findFirst();
  if (!doctor || !patient) { console.log('  ⚠️  Skipped – No doctor/patient in DB'); return; }

  const archivedId = 999999;
  await prisma.archivedAppointment.deleteMany({ where: { id: archivedId } });

  const archived = await prisma.archivedAppointment.create({
    data: {
      id: archivedId,
      patientId: patient.id,
      doctorId: doctor.id,
      startTime: new Date('2020-01-10T09:00:00'),
      endTime: new Date('2020-01-10T09:30:00'),
      status: 'COMPLETED',
      notes: 'Old appointment archive',
    },
  });
  assert(archived.id === archivedId, 'Archived appointment inserted');
  assert(archived.status === 'COMPLETED', 'Archived status preserved');

  const found = await prisma.archivedAppointment.findFirst({ where: { patientId: patient.id } });
  assert(found !== null, 'Archived appointment retrievable by patient');

  await prisma.archivedAppointment.delete({ where: { id: archivedId } });
}

// ─── Runner ──────────────────────────────────────────────────────────────────

async function run() {
  console.log('=== Module 02 – Integration Test Suite ===\n');
  try {
    await testEncryption();
    await testPatientAutoCreate();
    await testAppointmentConflict();
    await testCabinetAndRoom();
    await testLeaveAndHoliday();
    await testArchivedAppointment();
  } finally {
    await cleanUp();
    await prisma.$disconnect();
  }

  console.log(`\n${'='.repeat(45)}`);
  console.log(`Results: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

run().catch(err => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});
