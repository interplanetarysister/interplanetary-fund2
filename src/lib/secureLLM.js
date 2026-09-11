import { base44 } from "@/api/base44Client";
import { buildSecurePrompt, validateLLMObject } from "@/lib/promptSecurity";

const DEFAULT_TIMEOUT_MS = 30000;
const SAFE_LLM_ERROR = "AI generation is temporarily unavailable. Please try again.";

function raceWithTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("AI request timed out")), timeoutMs); });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

// Central AI gateway: keeps instructions separate from untrusted data and validates returned text.
export async function secureInvokeLLM({ task, trustedContext = "", untrusted = [], response_json_schema, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  try {
    const result = await raceWithTimeout(base44.integrations.Core.InvokeLLM({
      prompt: buildSecurePrompt({ task, trustedContext, untrusted }),
      ...(response_json_schema ? { response_json_schema } : {}),
    }), timeoutMs);
    return validateLLMObject(result, response_json_schema);
  } catch (error) {
    throw new Error(SAFE_LLM_ERROR);
  }
}
