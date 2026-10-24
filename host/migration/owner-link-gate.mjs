/**
 * IFund Base44 -> Supabase identity-link gate. Dormant until wired to two
 * independently authenticated server-side session verifiers and an atomic DB
 * compare-and-set. No session token or owner email is returned to callers.
 *
 * Verifiers must validate live sessions against their own identity providers;
 * decoded JWT payloads, email matches, and candidate_auth_uid are NOT proof.
 */
const SOURCE_ID = /^[0-9a-f]{24}$/i;
const DESTINATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const denied = (reason) => ({ ok: false, linked: false, reason });
const normalizeEmail = (value) => {
  if (typeof value !== 'string' || value.length > 254) return '';
  const email = value.trim().toLowerCase();
  return EMAIL.test(email) ? email : '';
};

export async function linkVerifiedOwnerSessions({
  verifySourceSession,
  verifyDestinationSession,
  loadSourceOwner,
  commitVerifiedLink,
} = {}) {
  if ([verifySourceSession, verifyDestinationSession, loadSourceOwner, commitVerifiedLink]
    .some((fn) => typeof fn !== 'function')) return denied('not_configured');

  let source;
  let destination;
  try {
    [source, destination] = await Promise.all([
      verifySourceSession(), verifyDestinationSession(),
    ]);
  } catch {
    return denied('identity_provider_unavailable');
  }
  if (source?.verified !== true || source?.active !== true ||
      !SOURCE_ID.test(String(source.id || '')) || !normalizeEmail(source.email))
    return denied('source_authentication_required');
  if (destination?.verified !== true ||
      !DESTINATION_ID.test(String(destination.id || '')) ||
      !normalizeEmail(destination.email) ||
      !destination.email_confirmed_at ||
      !Number.isFinite(Date.parse(destination.email_confirmed_at)))
    return denied('destination_authentication_required');

  const sourceEmail = normalizeEmail(source.email);
  const destinationEmail = normalizeEmail(destination.email);
  if (sourceEmail !== destinationEmail) return denied('identity_mismatch');

  let mapping;
  try { mapping = await loadSourceOwner(source.id); }
  catch { return denied('storage_unavailable'); }
  if (!mapping || mapping.source_owner_id !== source.id ||
      normalizeEmail(mapping.source_email) !== sourceEmail)
    return denied('source_owner_not_found');
  // A legacy four-column lookup cannot establish the provenance of a link.
  if (!Object.prototype.hasOwnProperty.call(mapping, 'candidate_match_method'))
    return denied('owner_provenance_unavailable');

  if (mapping.verification_state === 'verified') {
    if (mapping.destination_auth_uid !== destination.id) return denied('link_conflict');
    // A historical confirmed-email match is NOT a completed owner-link proof.
    // Missing provenance is equally untrusted. The service-only lookup must
    // return candidate_match_method explicitly; older 4-column RPCs fail closed.
    // Upgrading such a mapping requires a separate, audited atomic consent
    // transition; never silently convert it into a session-proven link here.
    if (mapping.candidate_match_method !== null)
      return denied('owner_proof_upgrade_required');
    return { ok: true, linked: true, alreadyLinked: true };
  }
  if (mapping.verification_state !== 'awaiting_destination_login' ||
      mapping.destination_auth_uid != null)
    return denied('link_conflict');
  if (mapping.candidate_match_method !== null)
    return denied('owner_proof_upgrade_required');

  // commitVerifiedLink MUST be an atomic database compare-and-set, checking
  // expected state, source ID/email, empty destination UID, and unique target UID.
  // No browser, client-side role claim, or candidate hint can invoke it directly.
  let result;
  try {
    result = await commitVerifiedLink({
      sourceOwnerId: source.id,
      destinationAuthUid: destination.id,
      expectedEmail: sourceEmail,
      expectedState: 'awaiting_destination_login',
    });
  } catch { return denied('storage_unavailable'); }
  if (result?.linked !== true ||
      result?.source_owner_id !== source.id ||
      result?.destination_auth_uid !== destination.id ||
      result?.verification_state !== 'verified')
    return denied('link_conflict');
  return { ok: true, linked: true, alreadyLinked: false };
}
