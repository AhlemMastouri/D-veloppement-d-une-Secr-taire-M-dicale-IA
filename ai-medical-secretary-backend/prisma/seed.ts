import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Clean existing data
  await prisma.medicalDictation.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.doctorAvailability.deleteMany({});
  await prisma.callLog.deleteMany({});
  await prisma.faq.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Create Users (Doctors, Secretaries, Admins)
  const hashedPassword = bcrypt.hashSync('password123', 10);

  const drDupont = await prisma.user.create({
    data: {
      email: 'jean.dupont@cabinet.fr',
      password: hashedPassword,
      name: 'Dr. Jean Dupont',
      role: 'DOCTOR',
      specialty: 'Généraliste',
    },
  });

  const drLefevre = await prisma.user.create({
    data: {
      email: 'sophie.lefevre@cabinet.fr',
      password: hashedPassword,
      name: 'Dr. Sophie Lefèvre',
      role: 'DOCTOR',
      specialty: 'Pédiatrie',
    },
  });

  const secretaryMarie = await prisma.user.create({
    data: {
      email: 'marie.martin@cabinet.fr',
      password: hashedPassword,
      name: 'Marie Martin',
      role: 'SECRETARY',
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@cabinet.fr',
      password: hashedPassword,
      name: 'Admin Cabinet',
      role: 'ADMIN',
    },
  });

  console.log('Users seeded!');

  // 3. Create Doctor Availabilities
  // Dr. Dupont: Monday (1) to Friday (5) from 09:00 to 12:00 and 14:00 to 18:00
  for (let day = 1; day <= 5; day++) {
    await prisma.doctorAvailability.create({
      data: {
        doctorId: drDupont.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '12:00',
      },
    });
    await prisma.doctorAvailability.create({
      data: {
        doctorId: drDupont.id,
        dayOfWeek: day,
        startTime: '14:00',
        endTime: '18:00',
      },
    });
  }

  // Dr. Lefèvre: Tuesday (2) & Thursday (4) from 08:30 to 16:30
  for (const day of [2, 4]) {
    await prisma.doctorAvailability.create({
      data: {
        doctorId: drLefevre.id,
        dayOfWeek: day,
        startTime: '08:30',
        endTime: '16:30',
      },
    });
  }

  console.log('Availabilities seeded!');

  // 4. Create Patients
  const patientAlice = await prisma.patient.create({
    data: {
      firstName: 'Alice',
      lastName: 'Dubois',
      dob: new Date('1990-05-15'),
      phone: '+33612345678',
      email: 'alice.dubois@gmail.com',
      insurance: 'Carte Vitale + Mutuelle Aésio',
      treatingPhysician: 'Dr. Jean Dupont',
      consentGdpr: true,
    },
  });

  const patientBob = await prisma.patient.create({
    data: {
      firstName: 'Bob',
      lastName: 'Lemoine',
      dob: new Date('1982-11-23'),
      phone: '+33687654321',
      email: 'bob.lemoine@yahoo.fr',
      insurance: 'Carte Vitale',
      treatingPhysician: 'Dr. Jean Dupont',
      consentGdpr: true,
    },
  });

  const patientCharlie = await prisma.patient.create({
    data: {
      firstName: 'Charlie',
      lastName: 'Gerard',
      dob: new Date('2015-08-04'),
      phone: '+33799887766',
      email: 'parent.charlie@outlook.com',
      insurance: 'Carte Vitale',
      treatingPhysician: 'Dr. Sophie Lefèvre',
      consentGdpr: true,
    },
  });

  console.log('Patients seeded!');

  // 5. Create Appointments
  // Set dates relative to today
  const today = new Date();
  const tomorrowAt9 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 9, 0, 0);
  const tomorrowAt9_30 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 9, 30, 0);

  const dayAfterTomorrowAt10 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 10, 0, 0);
  const dayAfterTomorrowAt10_30 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 10, 30, 0);

  const appt1 = await prisma.appointment.create({
    data: {
      patientId: patientAlice.id,
      doctorId: drDupont.id,
      startTime: tomorrowAt9,
      endTime: tomorrowAt9_30,
      status: 'CONFIRMED',
      notes: 'Consultation annuelle de contrôle',
    },
  });

  const appt2 = await prisma.appointment.create({
    data: {
      patientId: patientCharlie.id,
      doctorId: drLefevre.id,
      startTime: dayAfterTomorrowAt10,
      endTime: dayAfterTomorrowAt10_30,
      status: 'PENDING',
      notes: 'Fièvre persistante, pédiatrie',
    },
  });

  console.log('Appointments seeded!');

  // 6. Create FAQs
  await prisma.faq.createMany({
    data: [
      {
        question: 'Quels sont les horaires d\'ouverture du cabinet ?',
        answer: 'Le cabinet est ouvert du lundi au vendredi de 8h30 à 19h00, et le samedi matin de 9h00 à 12h00.',
        category: 'horaires',
      },
      {
        question: 'Quelle est l\'adresse du cabinet ?',
        answer: 'Nous sommes situés au 14 Rue de la Paix, 75002 Paris, au 2ème étage avec ascenseur.',
        category: 'adresse',
      },
      {
        question: 'Y a-t-il un parking à proximité ?',
        answer: 'Oui, le parking public Indigo "Place de la Concorde" se trouve à 5 minutes à pied du cabinet.',
        category: 'parking',
      },
      {
        question: 'Quels sont vos tarifs pour une consultation standard ?',
        answer: 'La consultation chez nos médecins généralistes est de 25€ (secteur 1, conventionné). Pour la pédiatrie, le tarif est de 30€.',
        category: 'tarifs',
      },
      {
        question: 'Quels sont les moyens de paiement acceptés ?',
        answer: 'Nous acceptons les cartes bancaires, les chèques et les espèces. La carte Vitale est acceptée pour le tiers payant.',
        category: 'tarifs',
      },
      {
        question: 'Comment se préparer avant une téléconsultation ?',
        answer: 'Assurez-vous d\'avoir une connexion internet stable, installez-vous dans un endroit calme et préparez votre carte Vitale ainsi que votre dernière ordonnance si besoin.',
        category: 'preparations',
      },
    ],
  });

  console.log('FAQs seeded!');

  // 7. Create Call Logs (Simulated AI call history)
  await prisma.callLog.create({
    data: {
      direction: 'INBOUND',
      phoneNumber: '+33612345678',
      status: 'COMPLETED',
      duration: 145,
      classification: 'APPOINTMENT_BOOKING',
      language: 'Français',
      patientId: patientAlice.id,
      transcript: JSON.stringify([
        { sender: 'AI', text: 'Bonjour, cabinet médical du Dr Dupont, que puis-je faire pour vous ?' },
        { sender: 'PATIENT', text: 'Bonjour, je voudrais prendre un rendez-vous avec le docteur Dupont pour demain matin s\'il vous plaît.' },
        { sender: 'AI', text: 'Bien sûr. Le créneau de 9h00 est libre. Cela vous convient-il ?' },
        { sender: 'PATIENT', text: 'Oui, c\'est parfait.' },
        { sender: 'AI', text: 'Très bien. C\'est noté pour demain à 9h00. Vous recevrez une confirmation par SMS.' },
      ]),
      summary: 'Prise de rendez-vous confirmée pour Alice Dubois le 2026-07-21 à 09h00.',
    },
  });

  await prisma.callLog.create({
    data: {
      direction: 'INBOUND',
      phoneNumber: '+33699999999',
      status: 'COMPLETED',
      duration: 65,
      classification: 'EMERGENCY',
      language: 'Français',
      transcript: JSON.stringify([
        { sender: 'AI', text: 'Bonjour, cabinet médical, comment puis-je vous aider ?' },
        { sender: 'PATIENT', text: 'Bonjour, j\'ai une douleur intense dans la poitrine depuis 10 minutes et du mal à respirer !' },
        { sender: 'AI', text: 'Il s\'agit d\'une urgence médicale critique. Je vous transfère immédiatement au secrétariat de garde et veuillez composer le 15 si le transfert échoue.' },
      ]),
      summary: 'Appel d\'urgence pour douleur thoracique. Transfert immédiat vers secrétaire/SAMU.',
    },
  });

  await prisma.callLog.create({
    data: {
      direction: 'INBOUND',
      phoneNumber: '+33655555555',
      status: 'COMPLETED',
      duration: 52,
      classification: 'INFO_REQUEST',
      language: 'Français',
      transcript: JSON.stringify([
        { sender: 'AI', text: 'Bonjour, cabinet médical, comment puis-je vous aider ?' },
        { sender: 'PATIENT', text: 'Bonjour, est-ce qu\'il y a un parking à côté du cabinet ?' },
        { sender: 'AI', text: 'Oui, le parking public Indigo "Place de la Concorde" est situé à 5 minutes de marche du cabinet.' },
        { sender: 'PATIENT', text: 'D\'accord, merci beaucoup.' },
      ]),
      summary: 'Demande d\'information sur le parking. Réponse fournie via la FAQ.',
    },
  });

  console.log('Call logs seeded!');

  // 8. Create Medical Dictation sample
  await prisma.medicalDictation.create({
    data: {
      doctorId: drDupont.id,
      patientId: patientAlice.id,
      rawTranscript: 'Consultation Alice Dubois. Examen clinique normal. Tension artérielle 12/7. Pouls régulier. Légère pharyngite suspectée mais pas de fièvre. Prescription de paracétamol et repos de 2 jours.',
      summary: 'Patient exam standard. Pharyngite suspectée sans fièvre. Repos et paracétamol.',
      notes: 'Prescription: Paracétamol 1g, 3 fois par jour pendant 3 jours. Arrêt de travail: 2 jours.',
      exportPdfUrl: '/exports/dictation_alice_dubois_2026-07-21.pdf',
    },
  });

  console.log('Dictations seeded!');
  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
