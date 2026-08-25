import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Account deletion is a durable workflow request. The destructive/anonymizing
// stages are intentionally not performed inline: financial retention,
// provider reconciliation, credential revocation, and resumable recovery must
// be handled by the authoritative deletion worker before the account itself
// is removed or anonymized.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const requests = await base44.entities.AccountDeletionRequest.filter({ user_id: user.id });
    const active = (requests || []).find((request) =>
      request.status === 'requested' || request.status === 'processing'
    );

    if (active) {
      return Response.json({
        deletion_requested: true,
        status: active.status,
      });
    }

    await base44.entities.AccountDeletionRequest.create({
      user_id: user.id,
      status: 'requested',
      requested_at: new Date().toISOString(),
      attempt_count: 0,
    });

    return Response.json({
      deletion_requested: true,
      status: 'requested',
    });
  } catch (error) {
    console.error('deleteAccount request failed:', error);
    return Response.json({ error: 'Unable to start account deletion. Please try again.' }, { status: 500 });
  }
}