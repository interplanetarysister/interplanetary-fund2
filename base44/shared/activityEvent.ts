// Emits an ActivityEvent record as the service role. Centralized so every
// feed-emitting backend function writes events consistently. Best-effort:
// never throws to the caller — a failed feed event must not break the
// donation, update, or campaign-creation flow it accompanies.

const MAX_METADATA_KEYS = 12;
const MAX_METADATA_STRING_LENGTH = 160;
const SAFE_METADATA_KEY = /^[a-zA-Z0-9_]{1,40}$/;

function diagnosticType(error) {
  if (error instanceof TypeError) return 'TypeError';
  if (error instanceof RangeError) return 'RangeError';
  if (error instanceof SyntaxError) return 'SyntaxError';
  if (error instanceof ReferenceError) return 'ReferenceError';
  if (error instanceof Error) return 'Error';
  return typeof error;
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;

  const safe = {};
  let count = 0;
  for (const [key, value] of Object.entries(metadata)) {
    if (count >= MAX_METADATA_KEYS || !SAFE_METADATA_KEY.test(key)) continue;
    if (typeof value === 'string') {
      safe[key] = value.slice(0, MAX_METADATA_STRING_LENGTH);
      count += 1;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      safe[key] = value;
      count += 1;
    } else if (typeof value === 'boolean') {
      safe[key] = value;
      count += 1;
    }
  }
  return Object.keys(safe).length ? safe : undefined;
}

export async function emitActivityEvent(base44, event) {
  try {
    const sr = base44.asServiceRole;
    await sr.entities.ActivityEvent.create({
      type: event.type,
      actor_user_id: event.actor_user_id || undefined,
      actor_display_name: event.actor_display_name || undefined,
      actor_handle: event.actor_handle || undefined,
      actor_image_url: event.actor_image_url || undefined,
      campaign_id: event.campaign_id || undefined,
      campaign_title: event.campaign_title || undefined,
      campaign_image_url: event.campaign_image_url || undefined,
      body: event.body,
      link: event.link || undefined,
      visibility: event.visibility || 'public',
      metadata: sanitizeMetadata(event.metadata),
    });
  } catch (e) {
    console.error('emitActivityEvent failed', { diagnosticType: diagnosticType(e) });
  }
}
