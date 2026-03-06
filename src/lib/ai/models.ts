import type { SelectOptionElement } from "chat";
import { gateway } from "@/lib/ai/gateway";

export interface CtfEligibleModel {
  id: string;
  label: string;
  description: string;
}

/**
 * Curated list of models known to support tool use and perform well at coding tasks.
 * Used to populate model selection dropdowns in the CTF start modal.
 */
export const CTF_ELIGIBLE_MODELS: CtfEligibleModel[] = [
  // Anthropic
  {
    id: "anthropic/claude-opus-4.6",
    label: "Claude Opus 4.6",
    description: "Anthropic's most capable model",
  },
  {
    id: "anthropic/claude-opus-4.5",
    label: "Claude Opus 4.5",
    description: "Anthropic's previous flagship",
  },
  {
    id: "anthropic/claude-sonnet-4.6",
    label: "Claude Sonnet 4.6",
    description: "Fast & capable",
  },
  {
    id: "anthropic/claude-sonnet-4.5",
    label: "Claude Sonnet 4.5",
    description: "Extended thinking support",
  },
  {
    id: "anthropic/claude-sonnet-4",
    label: "Claude Sonnet 4",
    description: "Balanced speed & quality",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    description: "Fastest Anthropic model",
  },
  // OpenAI
  {
    id: "openai/gpt-5",
    label: "GPT-5",
    description: "OpenAI's most capable model",
  },
  {
    id: "openai/gpt-5.2-codex",
    label: "GPT-5.2 Codex",
    description: "Optimized for code",
  },
  {
    id: "openai/gpt-5.1-codex",
    label: "GPT-5.1 Codex",
    description: "Code-focused model",
  },
  {
    id: "openai/gpt-4.1",
    label: "GPT-4.1",
    description: "Strong general-purpose model",
  },
  {
    id: "openai/gpt-4.1-mini",
    label: "GPT-4.1 Mini",
    description: "Compact & fast",
  },
  {
    id: "openai/o4-mini",
    label: "o4-mini",
    description: "OpenAI reasoning model",
  },
  // Google
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "Google's top model",
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description: "Fast Google model",
  },
  {
    id: "google/gemini-3-pro-preview",
    label: "Gemini 3 Pro Preview",
    description: "Latest Google preview",
  },
  // xAI
  {
    id: "xai/grok-4",
    label: "Grok 4",
    description: "xAI's latest model",
  },
  {
    id: "xai/grok-3",
    label: "Grok 3",
    description: "xAI's capable model",
  },
  // Mistral
  {
    id: "mistral/devstral-2",
    label: "Devstral 2",
    description: "Mistral coding model",
  },
  {
    id: "mistral/mistral-large-3",
    label: "Mistral Large 3",
    description: "Mistral's flagship",
  },
  // DeepSeek
  {
    id: "deepseek/deepseek-v3.2",
    label: "DeepSeek V3.2",
    description: "Latest DeepSeek model",
  },
  {
    id: "deepseek/deepseek-v3.1",
    label: "DeepSeek V3.1",
    description: "Strong open model",
  },
  // Meta
  {
    id: "meta/llama-4-maverick",
    label: "Llama 4 Maverick",
    description: "Meta's top open model",
  },
];

const GATEWAY_TIMEOUT_MS = 2500;

/**
 * Returns SelectOptionElement[] for use in Select components.
 * Filters CTF_ELIGIBLE_MODELS against gateway availability.
 * Falls back to the full curated list if gateway is unreachable.
 */
export async function getCtfModelOptions(): Promise<SelectOptionElement[]> {
  try {
    const { models } = await Promise.race([
      gateway.getAvailableModels(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gateway timeout")), GATEWAY_TIMEOUT_MS)
      ),
    ]);

    const languageModelIds = new Set(
      models
        .filter((m) => !m.modelType || m.modelType === "language")
        .map((m) => m.id)
    );

    if (languageModelIds.size === 0) {
      return toSelectOptions(CTF_ELIGIBLE_MODELS);
    }

    const available = CTF_ELIGIBLE_MODELS.filter((m) =>
      languageModelIds.has(m.id)
    );

    return toSelectOptions(available.length >= 2 ? available : CTF_ELIGIBLE_MODELS);
  } catch {
    return toSelectOptions(CTF_ELIGIBLE_MODELS);
  }
}

function toSelectOptions(models: CtfEligibleModel[]): SelectOptionElement[] {
  return models.map((m) => ({
    label: m.label,
    value: m.id,
    description: m.description,
  }));
}
