// Canonical-first UI resolver. Explicit canonical decisions always override
// stale legacy fields; while migration is incomplete, either legacy AI grant
// counts as the user's single IFund-wide authorization.
export function resolveUnifiedOboConsent(user) {
  const canonical = user?.ai_obo_consent;
  if (typeof canonical?.granted === "boolean") return canonical;

  const publishing = user?.ai_publishing_consent;
  const connection = user?.ai_connection_consent;
  if (!publishing && !connection) return null;

  const decidedAt = [publishing?.decided_at, connection?.decided_at]
    .filter(Boolean)
    .sort()
    .at(-1) || null;
  return {
    granted: publishing?.granted === true || connection?.granted === true,
    decided_at: decidedAt,
    permission_version: "legacy-unified-migration",
  };
}
