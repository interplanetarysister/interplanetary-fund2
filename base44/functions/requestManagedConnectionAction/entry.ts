import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { hasUnifiedOboConsent } from '../../shared/integrationRegistry.ts';
import { hasManagedConnections } from '../../shared/subscriptionEntitlements.ts';
import { staticRecipe, orderedTransports } from '../../shared/platformConnectionRecipes.ts';

const ACTIONS = new Set(['connect', 'create_account', 'repair', 'reauthorize']);
const clean = (value: unknown, max = 300) =>
  String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

async function resolveRecipe(sr: any, platform: string, operation: string) {
  const rows = await sr.entities.PlatformConnectionRecipe.filter({ platform, operation }).catch(() => []);
  const persisted = rows?.[0] || null;
  const seed = staticRecipe(platform, operation);
  const effective = persisted && persisted.status !== 'disabled'
    ? persisted
    : seed
      ? { platform, operation, status: 'probation', ...seed }
      : { platform, operation, status: 'probation', preferred_transport: 'manual' };
  return {
    recipe: effective,
    transport_order: orderedTransports(effective),
    rediscovery_required: effective.status === 'stale' || (!persisted && !seed),
  };
}

function waitingRequirement(action: string, transport: string | null) {
  if (action === 'create_account') {
    return 'Account creation requires a provider-supported creation route. IFund will continue only when a real executable route exists.';
  }
  if (transport === 'oauth') return 'Provider sign-in or consent is required on the provider page.';
  if (transport === 'token') return 'Connection details must be supplied through the protected IFund connection form.';
  if (transport === 'webhook') return 'The provider webhook or verification setup must be completed before IFund can verify the connection.';
  if (transport === 'public_browser') return 'A valid provider campaign URL is required before IFund can verify the public connection.';
  if (transport === 'authenticated_browser') return 'A protected provider session is required before IFund can continue.';
  return 'A supported provider connection step is required before IFund can continue.';
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasManagedConnections(user)) {
      return Response.json(
        { error: 'Managed Connections requires an eligible active subscription.' },
        { status: 403 },
      );
    }
    if (!hasUnifiedOboConsent(user)) {
      return Response.json(
        { error: 'Turn on IFund help before asking Managed Connections to act for you.' },
        { status: 403 },
      );
    }
    const consentVersion = String(user.ai_obo_consent?.permission_version || '').trim();
    if (!consentVersion) {
      return Response.json(
        { error: 'Review and renew your IFund help permission before Managed Connections acts for you.' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const platform = clean(body.platform, 80).toLowerCase();
    const action = clean(body.action, 40).toLowerCase();
    const connectionId = clean(body.connection_id, 120);
    const campaignId = clean(body.campaign_id, 120);

    if (!platform || !ACTIONS.has(action)) {
      return Response.json({ error: 'A supported platform action is required.' }, { status: 400 });
    }
    if ((action === 'repair' || action === 'reauthorize') && !connectionId) {
      return Response.json({ error: 'An existing connection is required for this action.' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    let connection: any = null;
    if (connectionId) {
      // Prove ownership in owner mode before any service-role access or delegated action.
      const visible = await base44.entities.PlatformConnection.get(connectionId).catch(() => null);
      if (!visible || visible.created_by_id !== user.id || visible.platform !== platform) {
        return Response.json({ error: 'Connection not found.' }, { status: 404 });
      }
      connection = await sr.entities.PlatformConnection.get(connectionId).catch(() => null);
      if (!connection || connection.created_by_id !== user.id || connection.platform !== platform) {
        return Response.json({ error: 'Connection not found.' }, { status: 404 });
      }
      if (
        connection.obo_consent?.granted !== true ||
        String(connection.obo_consent?.permission_version || '') !== consentVersion
      ) {
        return Response.json(
          { error: 'This connection needs the current IFund help authorization before delegated repair can run.' },
          { status: 403 },
        );
      }
    }

    let campaign: any = null;
    if (campaignId) {
      campaign = await base44.entities.Campaign.get(campaignId).catch(() => null);
      if (!campaign || campaign.created_by_id !== user.id) {
        return Response.json({ error: 'Campaign not found.' }, { status: 404 });
      }
      if (connection?.campaign_id && connection.campaign_id !== campaignId) {
        return Response.json({ error: 'Connection and campaign do not match.' }, { status: 409 });
      }
    }

    if (
      connection &&
      action !== 'reauthorize' &&
      connection.status === 'connected' &&
      connection.verification_status === 'verified' &&
      !connection.last_error
    ) {
      return Response.json({
        accepted: true,
        state: 'completed',
        already_connected: true,
        platform,
        action,
        connection_id: connection.id,
        message: 'This connection is already verified and working.',
      });
    }

    const operation = action === 'create_account' ? 'account_create' : 'connect';
    const resolved = await resolveRecipe(sr, platform, operation);
    const transports = resolved.transport_order.filter((t: string) => t && t !== 'manual');
    const nextTransport = transports[0] || null;
    const now = new Date().toISOString();

    const delegation = await base44.entities.AgentDelegation.create({
      owner_user_id: user.id,
      campaign_id: campaign?.id || connection?.campaign_id || undefined,
      campaign_title_snapshot: campaign?.title || '',
      source_agent: 'user',
      destination_agent: 'managed_connection_agent',
      objective: `${action} ${platform}`,
      context_summary: connection
        ? `Continue Managed Connections work for the owner's existing ${platform} connection ${connection.id}.`
        : `Continue Managed Connections work for the owner's ${platform} account without storing secrets in delegation context.`,
      context_provenance: [{
        claim: 'Managed Connections request originated from the authenticated owner.',
        source_type: 'user_statement',
        source_reference: 'requestManagedConnectionAction',
        confidence: 'verified',
      }],
      status: 'in_progress',
      consent_version: consentVersion,
      continuation_state: {
        pending_step: action === 'create_account' ? 'resolve_account_creation_route' : 'verify_or_prepare_connection',
        completed_steps: ['authorization_checked', 'ownership_checked', 'route_resolved'],
        external_requirement: '',
        return_route: '/connections',
      },
      retry_count: 0,
      max_retries: 3,
      last_attempt_at: now,
      created_at: now,
      updated_at: now,
    });

    if (connection && (action === 'connect' || action === 'repair')) {
      const verification = await base44.functions.invoke('verifyPlatformConnection', {
        connection_id: connection.id,
      }).catch(() => null);
      const verified = verification?.data;
      if (verified?.working === true) {
        await base44.entities.AgentDelegation.update(delegation.id, {
          status: 'completed',
          result_summary: 'The existing connection passed a live provider verification check.',
          verification: `verifyPlatformConnection:${connection.id}`,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          continuation_state: {
            pending_step: '',
            completed_steps: ['authorization_checked', 'ownership_checked', 'route_resolved', 'provider_verified'],
            external_requirement: '',
            return_route: '/connections',
          },
        });
        return Response.json({
          accepted: true,
          state: 'completed',
          platform,
          action,
          connection_id: connection.id,
          delegation_id: delegation.id,
          working: true,
          message: 'The connection is verified and working.',
        });
      }
    }

    const externalRequirement = waitingRequirement(action, nextTransport);
    const waitForUser = ['oauth', 'token', 'authenticated_browser'].includes(String(nextTransport || ''))
      || action === 'reauthorize';
    const nextStatus = waitForUser ? 'waiting_user' : 'waiting_external';

    await base44.entities.AgentDelegation.update(delegation.id, {
      status: nextStatus,
      result_summary: resolved.rediscovery_required
        ? 'No current proven route is available; route discovery or provider setup is required.'
        : 'The request is authorized and preserved until the next provider-required step can be completed.',
      updated_at: new Date().toISOString(),
      continuation_state: {
        pending_step: resolved.rediscovery_required ? 'discover_supported_route' : 'resume_provider_connection',
        completed_steps: ['authorization_checked', 'ownership_checked', 'route_resolved'],
        external_requirement: externalRequirement,
        return_route: '/connections',
        continuation_ref: connection?.id || delegation.id,
      },
    });

    return Response.json({
      accepted: true,
      state: nextStatus,
      platform,
      action,
      connection_id: connection?.id || null,
      delegation_id: delegation.id,
      consent_version: consentVersion,
      candidate_transports: transports,
      next_transport: nextTransport,
      rediscovery_required: resolved.rediscovery_required,
      executable_now: false,
      next_route: '/connections',
      message: externalRequirement,
    });
  } catch (error) {
    console.error('requestManagedConnectionAction error:', error?.message || error);
    return Response.json({ error: 'IFund could not prepare this Managed Connections request.' }, { status: 500 });
  }
}
