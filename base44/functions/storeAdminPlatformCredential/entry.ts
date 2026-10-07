import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';

const ALLOWED_AGENTS = ['chief_of_staff','outreach','managed_connection_agent'];

function clean(value: unknown, max = 300) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 });
    if (!['admin','super_admin'].includes(user.role)) {
      return Response.json({ error: 'Administrator access required.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const approvalId = clean(body.approval_id, 120);
    const username = clean(body.username, 500);
    const secret = String(body.secret || '').trim();
    if (!approvalId || !username || !secret || secret.length > 4096) {
      return Response.json({ error: 'Approval, username, and sign-in secret are required.' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const approval = await sr.entities.AdminApproval.get(approvalId).catch(() => null);
    if (!approval || approval.category !== 'account_access' || ['denied','cancelled','executed'].includes(approval.status)) {
      return Response.json({ error: 'This account-access request is not available.' }, { status: 409 });
    }
    if (approval.target_type !== 'platform_owned_account') {
      return Response.json({ error: 'This approval is not for an IFund-owned platform account.' }, { status: 400 });
    }

    let account = await sr.entities.PlatformOwnedAccount.get(String(approval.target_id || '')).catch(() => null);
    if (!account) {
      const platform = clean(approval.target_id, 80).toLowerCase();
      const existing = await sr.entities.PlatformOwnedAccount.filter({ platform }).catch(() => []);
      account = existing.find((row: any) => row.status !== 'retired') || null;
      if (!account) {
        account = await sr.entities.PlatformOwnedAccount.create({
          platform,
          display_name: `Interplanetary Fund on ${platform}`,
          profile_description: 'Interplanetary Fund helps people build, manage, share, and grow fundraising campaigns across the places their communities already gather.',
          status: 'setup_in_progress',
          discovered_by: approval.requested_by_agent || 'outreach',
          last_checked_at: new Date().toISOString(),
        });
      }
    }

    if (!account?.id || !account?.platform) {
      return Response.json({ error: 'The platform account could not be prepared.' }, { status: 500 });
    }

    const priorRef = clean(account.credential_reference, 160);
    if (priorRef) {
      const old = await sr.entities.AdminCredentialVault.filter({ credential_ref: priorRef }).catch(() => []);
      for (const row of old || []) {
        await sr.entities.AdminCredentialVault.update(row.id, {
          status: 'revoked',
          updated_at: new Date().toISOString(),
        }).catch(() => {});
      }
    }

    const now = new Date().toISOString();
    const credentialRef = `ifund_credential_${crypto.randomUUID()}`;
    await sr.entities.AdminCredentialVault.create({
      credential_ref: credentialRef,
      platform: account.platform,
      platform_owned_account_id: account.id,
      approval_id: approval.id,
      username,
      secret_value: secret,
      allowed_agents: ALLOWED_AGENTS,
      status: 'active',
      created_by_user_id: user.id,
      created_at: now,
      updated_at: now,
      last_use_status: 'unused',
    });

    await sr.entities.PlatformOwnedAccount.update(account.id, {
      credential_reference: credentialRef,
      recovery_status: 'credential_vault_ready',
      status: account.status === 'planned' || account.status === 'approval_needed' ? 'setup_in_progress' : account.status,
      last_checked_at: now,
    });
    await sr.entities.AdminApproval.update(approval.id, {
      credential_status: 'received',
      status: approval.status === 'needs_information' ? 'pending' : approval.status,
    });
    await sr.entities.AdminActionMessage.create({
      approval_id: approval.id,
      sender_type: 'system',
      message_type: 'credentials_submitted',
      content: 'Protected platform credentials were saved to the service-only credential vault. Secret values are not available in this action history.',
      processing_status: 'processed',
      created_at: now,
      processed_at: now,
    }).catch(() => {});

    return Response.json({
      ok: true,
      platform: account.platform,
      account_id: account.id,
      credential_ref: credentialRef,
      allowed_agents: ALLOWED_AGENTS,
      credential_status: 'received',
    });
  } catch (error) {
    console.error('storeAdminPlatformCredential failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'The protected platform credential could not be saved.' }, { status: 500 });
  }
}
