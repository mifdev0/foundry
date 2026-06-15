import Groq from "groq-sdk";

export function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new Groq({ apiKey });
}

export const groqModel = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
