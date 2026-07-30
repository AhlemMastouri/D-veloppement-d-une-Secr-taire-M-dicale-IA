// src/ai/nlu/llmClient.ts
//
// Client LLM utilisant l'API Groq (gratuite, très rapide, modèles open-source).
// Compte gratuit sur https://console.groq.com → API Keys → Create API Key
// Variable d'env attendue : GROQ_API_KEY

interface LLMCallOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

const GROQ_MODEL = "llama-3.3-70b-versatile";

/**
 * Appelle le LLM (Groq) et force une réponse JSON strictement parsable.
 */
export async function callLLMJson<T>(options: LLMCallOptions): Promise<T> {
  const { systemPrompt, userPrompt, temperature = 0 } = options;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY ?? ""}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Erreur LLM (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const rawText: string = data.choices?.[0]?.message?.content ?? "";

  // Nettoyage des éventuels ```json ... ``` autour de la réponse
  const cleaned = rawText.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(
      `Réponse LLM non parsable en JSON: ${cleaned.slice(0, 200)}`
    );
  }
}