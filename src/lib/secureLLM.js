import { base44 } from "@/api/base44Client";
import { buildSecurePrompt, validateLLMObject } from "@/lib/promptSecurity";

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TIMEOUT_MS = 60000;
const SAFE_LLM_ERROR = "AI generation is temporarily unavailable. Please try again.";

function raceWithTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("AI request timed out")), timeoutMs); });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

// Central AI gateway: keeps instructions separate from untrusted data and validates returned text.
export async function secureInvokeLLM({ task, trustedContext = "", untrusted = [], response_json_schema, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  try {
    if (!response_json_schema || typeof response_json_schema !== "object") throw new Error("Structured output schema required");
    const boundedTimeout = Math.min(Math.max(Number(timeoutMs) || DEFAULT_TIMEOUT_MS, 1000), MAX_TIMEOUT_MS);
    const result = await raceWithTimeout(base44.integrations.Core.InvokeLLM({
      prompt: buildSecurePrompt({ task, trustedContext, untrusted }),
      response_json_schema,
    }), boundedTimeout);
    return validateLLMObject(result, response_json_schema);
  } catch (error) {
    throw new Error(SAFE_LLM_ERROR);
  }
}
