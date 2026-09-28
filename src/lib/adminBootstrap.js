export const ADMIN_BOOTSTRAP_EMAILS = Object.freeze([
  "interplanetarysister@gmail.com",
  "unrewound@gmail.com",
  "cuddlemeplatonically@gmail.com",
]);

export function isAdminBootstrapEmail(email) {
  return ADMIN_BOOTSTRAP_EMAILS.includes(String(email || "").trim().toLowerCase());
}

// This allowlist is recovery/bootstrap metadata only.
// Authorization throughout the product MUST continue to use the canonical
// backend User.role === "admin" result and server-side role checks.
