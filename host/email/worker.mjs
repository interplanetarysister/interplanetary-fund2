import PostalMime from "postal-mime";
import { handleOfficialEmail } from "./handler.mjs";

// Dedicated Email Worker; no change to IFund's live HTTP gateway.
// Activation requires Cloudflare routing rules, private R2, and signed Base44 ingress.
export default {
  async email(message, env) {
    await handleOfficialEmail(message, env, {
      parseEmail: (raw) => PostalMime.parse(raw),
    });
  },
};
