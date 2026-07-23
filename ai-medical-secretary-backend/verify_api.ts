import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:3000/api/v1';

async function runTests() {
  console.log('=== DÉBUT DES TESTS D\'INTÉGRATION API ===\n');

  try {
    // 1. Test de connexion (Auth)
    console.log('[TEST 1] Authentification du Secrétariat...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'marie.martin@cabinet.fr',
        password: 'password123',
      }),
    });
    
    if (!loginRes.ok) {
      throw new Error(`Échec de la connexion: ${loginRes.statusText}`);
    }
    
    const loginData = await loginRes.json() as any;
    const token = loginData.token;
    console.log('✓ Connexion réussie. Rôle de l\'utilisateur:', loginData.user.role);
    console.log('Jeton JWT obtenu.');

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    // 2. Récupérer les patients
    console.log('\n[TEST 2] Récupération de la liste des patients (Accès sécurisé)...');
    const patientsRes = await fetch(`${BASE_URL}/patients`, { headers });
    if (!patientsRes.ok) {
      throw new Error(`Échec de récupération des patients: ${patientsRes.statusText}`);
    }
    const patientsData = await patientsRes.json() as any;
    console.log(`✓ Nombre de patients récupérés: ${patientsData.patients.length}`);
    const firstPatient = patientsData.patients[0];
    console.log(`Premier patient: ${firstPatient.firstName} ${firstPatient.lastName} (${firstPatient.phone})`);

    // 3. Recherche FAQ
    console.log('\n[TEST 3] Recherche dans la FAQ pour "parking"...');
    const faqRes = await fetch(`${BASE_URL}/faqs/search?q=parking`);
    if (!faqRes.ok) {
      throw new Error(`Échec recherche FAQ: ${faqRes.statusText}`);
    }
    const faqData = await faqRes.json() as any;
    console.log(`✓ Résultat FAQ trouvé: "${faqData.faqs[0]?.question}"`);
    console.log(`Réponse: ${faqData.faqs[0]?.answer}`);

    // 4. Test de réservation de rendez-vous
    console.log('\n[TEST 4] Réservation d\'un rendez-vous pour Alice Dubois...');
    const testDate = new Date();
    // Book for tomorrow at 15:00
    testDate.setDate(testDate.getDate() + 1);
    testDate.setHours(15, 0, 0, 0);

    const apptPayload = {
      patientId: firstPatient.id,
      doctorId: 1, // Dr Dupont (seeded as ID 1 usually)
      startTime: testDate.toISOString(),
      duration: 30,
      notes: 'Consultation test API',
    };

    const bookRes = await fetch(`${BASE_URL}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apptPayload),
    });

    if (!bookRes.ok) {
      const errorMsg = await bookRes.json();
      console.log('Erreur renvoyée par le serveur:', errorMsg);
      throw new Error(`Échec réservation RDV: ${bookRes.statusText}`);
    }

    const bookData = await bookRes.json() as any;
    console.log('✓ Rendez-vous réservé avec succès ! ID:', bookData.appointment.id);
    console.log(`Statut: ${bookData.appointment.status}, Médecin: ${bookData.appointment.doctor.name}`);

    // 5. Test de prévention des doublons
    console.log('\n[TEST 5] Tentative de doublon (sur le même créneau)...');
    const doubleBookRes = await fetch(`${BASE_URL}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: 2, // Bob Lemoine
        doctorId: 1,
        startTime: testDate.toISOString(), // exact same time
        duration: 30,
      }),
    });

    if (doubleBookRes.status === 409) {
      console.log('✓ Succès: Le serveur a correctement refusé le doublon (Code 409 Conflict).');
      const conflictData = await doubleBookRes.json() as any;
      console.log(`Message d'erreur du serveur: "${conflictData.error}"`);
    } else {
      throw new Error(`Le serveur aurait dû refuser la réservation double (Status: ${doubleBookRes.status})`);
    }

    // 6. Test Statistiques Dashboard
    console.log('\n[TEST 6] Récupération des statistiques du Dashboard...');
    const statsRes = await fetch(`${BASE_URL}/calls/stats`, { headers });
    if (!statsRes.ok) {
      throw new Error(`Échec statistiques: ${statsRes.statusText}`);
    }
    const statsData = await statsRes.json() as any;
    console.log('✓ Statistiques récupérées:');
    console.log(`  - Total des appels: ${statsData.stats.totalCalls}`);
    console.log(`  - Appels manqués: ${statsData.stats.missedCalls}`);
    console.log(`  - Durée moyenne: ${statsData.stats.averageDurationSeconds} secondes`);
    console.log(`  - Temps médecin gagné: ${statsData.stats.timeSavedMinutes} minutes`);
    console.log(`  - Score satisfaction client: ${statsData.stats.patientSatisfactionScore}/5`);

    // 7. Test de Simulation OCR
    console.log('\n[TEST 7] Test de simulation de lecture OCR (Carte Vitale)...');
    const ocrRes = await fetch(`${BASE_URL}/services/ocr/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docType: 'carte_vitale' }),
    });

    if (!ocrRes.ok) {
      throw new Error(`Échec simulation OCR: ${ocrRes.statusText}`);
    }
    const ocrData = await ocrRes.json() as any;
    console.log('✓ OCR analysé avec succès.');
    console.log('Données extraites:', ocrData.parsedData);

    console.log('\n=== TOUS LES TESTS ONT RÉUSSI AVEC SUCCÈS ! ===');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Échec d\'un test d\'intégration API:', error);
    process.exit(1);
  }
}

runTests();
