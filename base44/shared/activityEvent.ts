// Emits an ActivityEvent record as the service role. Centralized so every
// feed-emitting backend function writes events consistently. Best-effort:
// never throws to the caller — a failed feed event must not break the
// donation, update, or campaign-creation flow it accompanies.

function classifyActivityEventFailure(error) {
  if (error instanceof Error) return 'error';
  if (error === null || error === undefined) return 'nullish';
  const kind = typeof error;
  return kind === 'string' || kind === 'number' || kind === 'boolean' || kind === 'bigint' || kind === 'symbol'
    ? kind
    : 'object';
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
      metadata: event.metadata || undefined,
    });
  } catch (error) {
    console.error('emitActivityEvent failed', {
      failure_type: classifyActivityEventFailure(error),
    });
  }
}
