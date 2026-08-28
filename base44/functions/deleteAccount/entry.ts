import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SAFE_ERROR = 'Unable to start account deletion. Please try again.';
const CLAIMED = 'active';
const DUPLICATE_REQUEST = 'duplicate_request';

// Account deletion is a durable workflow request. Destructive/anonymizing
// stages are intentionally not performed inline: financial retention,
// provider reconciliation, credential revocation, and resumable recovery must
// be handled by the authoritative deletion worker before account removal.
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

    // Persist the durable request before acquiring the User claim. This means
    // a process crash after the claim cannot leave a claimed User with no
    // corresponding recovery record. Concurrent requests may create more
    // than one intent, but only one can acquire the conditional User claim;
    // losing intents are immediately terminalized as duplicate_request.
    const requestId = `DEL_${user.id}_${crypto.randomUUID()}`;
    const claimToken = crypto.randomUUID();
    const requestedAt = new Date().toISOString();
    const created = await sr.entities.AccountDeletionRequest.create({
      user_id: user.id,
      request_id: requestId,
      claim_token: claimToken,
      status: 'requested',
      requested_at: requestedAt,
      attempt_count: 0,
    });

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
      if (existingRequestId && existingRequestId !== requestId) {
        await sr.entities.AccountDeletionRequest.updateMany(
          {
            id: created?.id,
            user_id: user.id,
            request_id: requestId,
            status: 'requested',
          },
          { status: 'failed', last_error_code: DUPLICATE_REQUEST }
        );
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

      // The claim was not acquired and no existing owner request was found.
      // Keep the durable request terminal and retryable rather than leaving an
      // orphaned active request or falsely reporting deletion completion.
      await sr.entities.AccountDeletionRequest.updateMany(
        {
          id: created?.id,
          user_id: user.id,
          request_id: requestId,
          status: 'requested',
        },
        { status: 'failed', last_error_code: DUPLICATE_REQUEST }
      );
      return Response.json({ error: SAFE_ERROR }, { status: 409 });
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
