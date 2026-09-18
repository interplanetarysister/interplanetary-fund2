const AUTH_MESSAGES = Object.freeze({
  login: "Invalid email or password",
  register: "Registration failed. Please try again.",
  verify: "Invalid verification code. Please try again.",
  resend: "Failed to resend code. Please try again.",
  reset: "Failed to reset password. Please request a new link or try again."
});

export function safeAuthErrorMessage(kind) {
  return AUTH_MESSAGES[kind] || "Authentication failed. Please try again.";
}
