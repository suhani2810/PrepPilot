// Provider-agnostic AI abstraction. Server-only.
// Primary: Groq (GROQ_API_KEY). Optional fallback: OpenRouter (OPENROUTER_API_KEY).
// Both providers expose an OpenAI-compatible chat/completions endpoint, so we
// use @ai-sdk/openai-compatible for a single adapter.
//
// Configuration (env, server-side only):
//   GROQ_API_KEY               — Groq API key
//   GROQ_MODEL                 — override default Groq model
//   OPENROUTER_API_KEY         — OpenRouter API key
//   OPENROUTER_MODEL           — override default OpenRouter model
//   AI_PROVIDER                — "groq" | "openrouter" (default: groq)

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export type ProviderName = "groq" | "openrouter";

type ProviderConfig = {
  baseURL: string;
  envKey: string;
  modelEnvKey: string;
  defaultModel: string;
};

const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  groq: {
    baseURL: "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY",
    modelEnvKey: "GROQ_MODEL",
    defaultModel: "llama-3.3-70b-versatile",
  },
  openrouter: {
    baseURL: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
    modelEnvKey: "OPENROUTER_MODEL",
    defaultModel: "google/gemini-2.0-flash-001",
  },
};

function buildModel(name: ProviderName): LanguageModel | null {
  const cfg = PROVIDERS[name];
  const key = process.env[cfg.envKey];
  if (!key) return null;
  const provider = createOpenAICompatible({
    name,
    baseURL: cfg.baseURL,
    headers: { Authorization: `Bearer ${key}` },
  });
  const modelId = process.env[cfg.modelEnvKey] || cfg.defaultModel;
  return provider(modelId);
}

/**
 * Returns the ordered list of configured AI models — primary first, then any
 * available fallbacks. Callers should try them in order on transient failure.
 */
export function getAIModels(): { name: ProviderName; model: LanguageModel }[] {
  const requested = (process.env.AI_PROVIDER as ProviderName | undefined) ?? "groq";
  const primary: ProviderName = requested === "openrouter" ? "openrouter" : "groq";
  const secondary: ProviderName = primary === "groq" ? "openrouter" : "groq";
  const out: { name: ProviderName; model: LanguageModel }[] = [];
  for (const p of [primary, secondary]) {
    const m = buildModel(p);
    if (m) out.push({ name: p, model: m });
  }
  if (out.length === 0) {
    throw new Error(
      "No AI provider configured. Set GROQ_API_KEY or OPENROUTER_API_KEY as a server-side environment variable.",
    );
  }
  return out;
}
