import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SAFE_ERROR = 'Unable to start account deletion. Please try again.';
const CLAIMED = 'active';

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

    const sr = base44.asServiceRole;
    const requests = await sr.entities.AccountDeletionRequest.filter({ user_id: user.id });
    const active = (requests || []).find((request) =>
      request.status === 'requested' || request.status === 'processing'
    );

    if (active) {
      return Response.json({
        deletion_requested: true,
        status: active.status,
        request_id: active.request_id,
      });
    }

    const requestId = `DEL_${user.id}_${crypto.randomUUID()}`;
    const claimToken = crypto.randomUUID();
    const claimResult = await sr.entities.User.updateMany(
      { id: user.id, account_deletion_status: { $ne: CLAIMED } },
      {
        account_deletion_status: CLAIMED,
        account_deletion_request_id: requestId,
        account_deletion_claim_token: claimToken,
      }
    );

    if (!claimResult?.count) {
      const owner = await sr.entities.User.get(user.id);
      const existingRequestId = owner?.account_deletion_request_id;
      if (existingRequestId) {
        const existing = await sr.entities.AccountDeletionRequest.filter({
          user_id: user.id,
          request_id: existingRequestId,
        });
        const request = (existing || [])[0];
        return Response.json({
          deletion_requested: true,
          status: request?.status || 'processing',
          request_id: existingRequestId,
        });
      }
      return Response.json({ error: SAFE_ERROR }, { status: 409 });
    }

    try {
      await sr.entities.AccountDeletionRequest.create({
        user_id: user.id,
        request_id: requestId,
        claim_token: claimToken,
        status: 'requested',
        requested_at: new Date().toISOString(),
        attempt_count: 0,
      });
    } catch (createError) {
      await sr.entities.User.updateMany(
        {
          id: user.id,
          account_deletion_status: CLAIMED,
          account_deletion_request_id: requestId,
          account_deletion_claim_token: claimToken,
        },
        {
          account_deletion_status: 'idle',
          account_deletion_request_id: null,
          account_deletion_claim_token: null,
        }
      );
      throw createError;
    }

    return Response.json({
      deletion_requested: true,
      status: 'requested',
      request_id: requestId,
    });
  } catch (error) {
    console.error('deleteAccount request failed:', error);
    return Response.json({ error: SAFE_ERROR }, { status: 500 });
  }
}