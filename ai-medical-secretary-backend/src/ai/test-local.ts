// src/ai/test-local.ts
//
// Test rapide en local, sans Twilio ni téléphone.
// Lancer avec : npx ts-node src/ai/test-local.ts
// (npm install -D ts-node si pas déjà installé)
import dotenv from "dotenv";
import path from "path";

import { extractEntities } from"./nlu/entityExtractor"
import { detectLanguage } from "./voice/languageDetector";
import { CallIntent } from "./types/call.types";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
async function testEntityExtraction() {
  console.log("\n=== TEST: entityExtractor ===");

  const messages = [
    "Bonjour, je voudrais un rendez-vous demain à 14h30 avec le Dr Ben Salah",
    "Je veux annuler mon rendez-vous de jeudi prochain",
    "C'est pour une consultation de suivi, rappelez-moi au 21612345678",
  ];

  for (const message of messages) {
    const result = await extractEntities(message, CallIntent.BOOK_APPOINTMENT);
    console.log(`\nMessage : "${message}"`);
    console.log("Entités extraites :", result.entities);
    console.log("Confiance :", result.confidence);
  }
}

async function testLanguageDetection() {
  console.log("\n=== TEST: languageDetector ===");

  const samples = [
    "Bonjour, je voudrais prendre rendez-vous",
    "Hello, I would like to book an appointment",
    "مرحبا، أريد حجز موعد",
    "Buongiorno, vorrei prenotare un appuntamento",
    "Hola, quiero reservar una cita",
  ];

  for (const text of samples) {
    const result = await detectLanguage(text);
    console.log(`\nTexte : "${text}"`);
    console.log("Langue détectée :", result.language, "| confiance :", result.confidence);
  }
}

async function main() {
  await testEntityExtraction();
  await testLanguageDetection();
}

main().catch(console.error);
