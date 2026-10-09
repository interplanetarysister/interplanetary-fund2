import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { hasUnifiedOboConsent } from '../../shared/integrationRegistry.ts';
import { hasManagedConnections } from '../../shared/subscriptionEntitlements.ts';

const LIVE = new Set(['requested', 'assigned', 'in_progress', 'waiting_user', 'waiting_external', 'needs_review']);
const clean = (value: unknown, n = 240) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);

function publicWork(item: any) {
  return {
    id: item.id,
    objective: clean(item.objective, 160),
    status: item.status,
    result_summary: clean(item.result_summary, 500),
    next_step: clean(item.continuation_state?.pending_step, 120),
    external_requirement: clean(item.continuation_state?.external_requirement, 400),
    connection_id: item.continuation_state?.continuation_ref === item.id
      ? null : clean(item.continuation_state?.continuation_ref, 120) || null,
    last_attempt_at: item.last_attempt_at || null,
    updated_at: item.updated_at || item.created_at || null,
    completed_at: item.completed_at || null,
    verification: item.status === 'completed' ? clean(item.verification, 150) : '',
  };
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const active = await assertActiveAccount(base44);
    if (!active.ok) return Response.json({ error: active.error }, { status: active.status });
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const mode = clean(body.mode || 'list', 16);
    const rows = await base44.entities.AgentDelegation.filter({
      owner_user_id: user.id,
      destination_agent: 'managed_connection_agent',
    }).catch(() => []);
    const owned = (Array.isArray(rows) ? rows : []).filter((item: any) => item.owner_user_id === user.id);
    if (mode === 'list') {
      const selected = owned.sort((a: any, b: any) =>
        String(b.updated_at || b.created_date || '').localeCompare(String(a.updated_at || a.created_date || ''))).slice(0, 20);
      return Response.json({ ok: true, work: selected.map(publicWork) }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }
    if (mode !== 'advance') return Response.json({ error: 'Unsupported operation.' }, { status: 400 });
    if (!hasManagedConnections(user) || !hasUnifiedOboConsent(user)) {
      return Response.json({ error: 'Active Managed Connections access and IFund help permission are required.' }, { status: 403 });
    }
    const work = owned.find((item: any) => item.id === clean(body.delegation_id, 120));
    if (!work) return Response.json({ error: 'Work item not found.' }, { status: 404 });
    if (!LIVE.has(work.status)) return Response.json({ ok: true, work: publicWork(work) });
    const consentVersion = clean(user.ai_obo_consent?.permission_version, 120);
    if (!consentVersion || work.consent_version !== consentVersion) {
      return Response.json({ error: 'IFund help permission has changed. Reauthorize this request.' }, { status: 403 });
    }
    const reference = clean(work.continuation_state?.continuation_ref, 120);
    if (!reference || reference === work.id) {
      return Response.json({
        ok: true, checked: false, work: publicWork(work),
        message: work.continuation_state?.external_requirement || 'A provider connection is needed before live verification can run.',
      });
    }
    const connection = await base44.entities.PlatformConnection.get(reference).catch(() => null);
    if (!connection || connection.created_by_id !== user.id) {
      return Response.json({ error: 'The linked connection is no longer accessible.' }, { status: 404 });
    }
    if (connection.obo_consent?.granted !== true ||
        connection.obo_consent?.permission_version !== consentVersion) {
      return Response.json({ error: 'This connection needs the current IFund help permission.' }, { status: 403 });
    }
    const last = Date.parse(work.last_attempt_at || '');
    if (Number.isFinite(last) && Date.now() - last < 30000) {
      return Response.json({ ok: true, checked: false, work: publicWork(work), message: 'This connection was checked recently.' });
    }
    const now = new Date().toISOString();
    await base44.entities.AgentDelegation.update(work.id, { last_attempt_at: now, updated_at: now });
    const verification = await base44.functions.invoke('verifyPlatformConnection', {
      connection_id: connection.id,
    }).catch(() => null);
    const result = verification?.data;
    if (result?.working === true) {
      const updated = await base44.entities.AgentDelegation.get(work.id).catch(() => null);
      return Response.json({ ok: true, checked: true, verified: true, work: publicWork(updated || {
        ...work, status: 'completed', completed_at: now,
        result_summary: 'A live provider check succeeded.', verification: 'verifyPlatformConnection:' + connection.id,
      }) });
    }
    // A failed provider check is not a successful automated repair; preserve the
    // original request and its next authorized step for the user to resume.
    const message = clean(result?.error || 'The provider did not verify this connection.', 300);
    await base44.entities.AgentDelegation.update(work.id, {
      result_summary: message,
      updated_at: new Date().toISOString(),
    });
    return Response.json({ ok: true, checked: true, verified: false,
      work: publicWork({ ...work, result_summary: message, updated_at: now }),
      message,
    });
  } catch (error) {
    console.error('manageAgentWork error:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'Could not check managed connection work.' }, { status: 500 });
  }
}
