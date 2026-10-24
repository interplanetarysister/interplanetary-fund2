/**
 * Dormant, server-only historical owner-link upgrade gate.
 * The three email-candidate mappings are NOT session-proven links.
 * This function must be called only after the trusted same-origin route has
 * validated a signed, one-time consent challenge and a durable rate limit.
 * The SQL upgrade must atomically update the exact existing mapping and
 * insert a durable consent receipt; never fall back to the legacy commit.
 * No bearer, email, nonce or owner identifier is returned to the browser.
 */
const SOURCE_ID = /^[a-f0-9]{24}$/i;
const DEST_ID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const ALLOWED_ORIGINS = new Set([
  'https://interplanetaryfund.com',
  'https://www.interplanetaryfund.com',
]);
const deny = reason => ({ ok: false, upgraded: false, reason });
function email(value) {
  if (typeof value !== 'string' || value.length > 254) return '';
  const normalized = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : '';
}

/**
 * @param {object} dependencies Server-only callbacks; verifiers must call the
 * live Base44 and Supabase user endpoints with the exact supplied bearers.
 * @param {object} proof Trusted, server-derived consent evidence, never client IDs.
 */
export async function upgradeHistoricalOwnerSessions({
  verifySourceSession,
  verifyDestinationSession,
  loadSourceOwner,
  upgradeHistoricalLink,
  consentNonceSha256,
  consentOrigin,
  consentExplicit,
  now = () => Date.now(),
} = {}) {
  if ([verifySourceSession, verifyDestinationSession, loadSourceOwner, upgradeHistoricalLink]
    .some(fn => typeof fn !== 'function')) return deny('not_configured');
  if (consentExplicit !== true || !SHA256.test(String(consentNonceSha256)) ||
      !ALLOWED_ORIGINS.has(consentOrigin)) return deny('consent_required');

  let source, destination, sourceCheckedAt, destinationCheckedAt;
  try {
    // Capture each successful provider verification separately. A historical
    // candidate or auth.users row cannot substitute for either live session.
    source = await verifySourceSession();
    sourceCheckedAt = new Date(now()).toISOString();
    destination = await verifyDestinationSession();
    destinationCheckedAt = new Date(now()).toISOString();
  } catch { return deny('identity_provider_unavailable'); }

  const sourceEmail = email(source?.email);
  const destinationEmail = email(destination?.email);
  if (source?.verified !== true || source?.active !== true ||
      !SOURCE_ID.test(String(source?.id || '')) || !sourceEmail)
    return deny('source_authentication_required');
  if (destination?.verified !== true || !DEST_ID.test(String(destination?.id || '')) ||
      !destinationEmail || !destination?.email_confirmed_at ||
      !Number.isFinite(Date.parse(destination.email_confirmed_at)))
    return deny('destination_authentication_required');
  if (sourceEmail !== destinationEmail) return deny('identity_mismatch');

  let mapping;
  try { mapping = await loadSourceOwner(source.id); }
  catch { return deny('storage_unavailable'); }
  if (!mapping || mapping.source_owner_id !== source.id ||
      email(mapping.source_email) !== sourceEmail)
    return deny('source_owner_not_found');
  if (mapping.verification_state !== 'verified' ||
      mapping.candidate_match_method !== 'confirmed_exact_email' ||
      mapping.candidate_auth_uid !== destination.id ||
      mapping.destination_auth_uid !== destination.id)
    return deny('historical_mapping_conflict');

  const checked = [Date.parse(sourceCheckedAt), Date.parse(destinationCheckedAt)];
  const instant = now();
  if (!Number.isFinite(instant) || checked.some(t => !Number.isFinite(t) ||
      t > instant || instant - t >= 60_000)) return deny('provider_proof_expired');

  let result;
  try {
    result = await upgradeHistoricalLink({
      sourceOwnerId: source.id,
      destinationAuthUid: destination.id,
      expectedEmail: sourceEmail,
      expectedState: 'verified',
      expectedCandidateMethod: 'confirmed_exact_email',
      consentNonceSha256,
      consentOrigin,
      sourceSessionCheckedAt: sourceCheckedAt,
      destinationSessionCheckedAt: destinationCheckedAt,
    });
  } catch { return deny('storage_unavailable'); }
  if (result?.upgraded !== true || result?.source_owner_id !== source.id ||
      result?.destination_auth_uid !== destination.id ||
      result?.verification_state !== 'verified') return deny('historical_mapping_conflict');
  return { ok: true, upgraded: true };
}
