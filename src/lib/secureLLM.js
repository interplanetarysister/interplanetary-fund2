import { base44 } from "@/api/base44Client";
import { buildSecurePrompt, validateLLMObject } from "@/lib/promptSecurity";

// Central AI gateway: keeps instructions separate from untrusted data and validates returned text.
export async function secureInvokeLLM({ task, trustedContext = "", untrusted = [], response_json_schema }) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: buildSecurePrompt({ task, trustedContext, untrusted }),
    ...(response_json_schema ? { response_json_schema } : {}),
  });
  return validateLLMObject(result);
}
