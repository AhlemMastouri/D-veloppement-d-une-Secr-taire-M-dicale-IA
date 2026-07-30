// src/ai/types/call.types.ts

export enum CallIntent {
  BOOK_APPOINTMENT = "BOOK_APPOINTMENT",
  MODIFY_APPOINTMENT = "MODIFY_APPOINTMENT",
  CANCEL_APPOINTMENT = "CANCEL_APPOINTMENT",
  EMERGENCY = "EMERGENCY",
  FAQ = "FAQ",
  CALLBACK_REQUEST = "CALLBACK_REQUEST",
  DOCUMENT_REQUEST = "DOCUMENT_REQUEST",
  UNKNOWN = "UNKNOWN",
}

export interface ExtractedEntities {
  date?: string;          // normalisé en ISO 8601 (YYYY-MM-DD) si possible
  time?: string;          // normalisé en HH:mm si possible
  doctorName?: string;
  reason?: string;
  patientPhone?: string;
  patientName?: string;
}

export type EntityField = keyof ExtractedEntities;

// Champs requis par intent pour considérer la demande "complète"
export const REQUIRED_FIELDS_BY_INTENT: Record<CallIntent, EntityField[]> = {
  [CallIntent.BOOK_APPOINTMENT]: ["date", "time", "reason"],
  [CallIntent.MODIFY_APPOINTMENT]: ["date", "time"],
  [CallIntent.CANCEL_APPOINTMENT]: ["date"],
  [CallIntent.EMERGENCY]: [],
  [CallIntent.FAQ]: [],
  [CallIntent.CALLBACK_REQUEST]: ["patientPhone"],
  [CallIntent.DOCUMENT_REQUEST]: [],
  [CallIntent.UNKNOWN]: [],
};

export interface ConversationTurn {
  role: "patient" | "ia";
  message: string;
  timestamp: string; // ISO datetime
}

export type ConversationStatus =
  | "collecting"   // il manque des infos, l'IA doit relancer
  | "confirming"   // toutes les infos sont là, en attente de confirmation patient
  | "completed"    // action effectuée (RDV créé/modifié/annulé)
  | "escalated";   // transféré à un humain

export interface ConversationState {
  callId: string;
  patientId?: number;
  currentIntent: CallIntent;
  collectedEntities: ExtractedEntities;
  missingFields: EntityField[];
  turnCount: number;
  history: ConversationTurn[];
  status: ConversationStatus;
  updatedAt: string; // ISO datetime
}

export interface DialogueResult {
  responseText: string;       // texte FR prêt pour TTS
  updatedState: ConversationState;
  requiresHuman: boolean;
}

// Résultat brut retourné par l'extracteur d'entités avant fusion avec le contexte
export interface EntityExtractionResult {
  entities: ExtractedEntities;
  confidence: number; // 0-1, utile pour décider si on redemande confirmation
}

// --- Assistant vocal multilingue ---

export enum SupportedLanguage {
  FRENCH = "fr",
  ENGLISH = "en",
  ARABIC = "ar",
  ITALIAN = "it",
  SPANISH = "es",
}

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  [SupportedLanguage.FRENCH]: "Français",
  [SupportedLanguage.ENGLISH]: "English",
  [SupportedLanguage.ARABIC]: "العربية",
  [SupportedLanguage.ITALIAN]: "Italiano",
  [SupportedLanguage.SPANISH]: "Español",
};

// Codes voix Google Cloud TTS recommandés par langue (voix neurales naturelles)
export const TTS_VOICE_BY_LANGUAGE: Record<SupportedLanguage, { languageCode: string; name: string }> = {
  [SupportedLanguage.FRENCH]: { languageCode: "fr-FR", name: "fr-FR-Neural2-C" },
  [SupportedLanguage.ENGLISH]: { languageCode: "en-US", name: "en-US-Neural2-F" },
  [SupportedLanguage.ARABIC]: { languageCode: "ar-XA", name: "ar-XA-Wavenet-A" },
  [SupportedLanguage.ITALIAN]: { languageCode: "it-IT", name: "it-IT-Neural2-A" },
  [SupportedLanguage.SPANISH]: { languageCode: "es-ES", name: "es-ES-Neural2-A" },
};

export interface VoiceCallState extends ConversationState {
  language: SupportedLanguage;
  languageLocked: boolean; // true une fois la langue confirmée en début d'appel
}
