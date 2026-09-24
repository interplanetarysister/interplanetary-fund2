import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';
import { assertPlatformAccess } from '../../shared/integrationRegistry.ts';

// Two-way sync between Base44 and GitHub using the native GitHub synchronization control
// (GitHub REST API via the connected OAuth connector). No shell commands are used;
// all git operations go through the GitHub API so credentials never touch the filesystem.
//
// Direction "pull": fetches the latest commit SHA on the default branch from GitHub
//   and records it so operators can detect drift between Base44 and the repo.
//   Full file-level pull is deferred until trusted workflow identity is established
//   (see docs/deferred-base44-workflows.md).
//
// Direction "push": uses the GitHub Trees and Commits API to push uncommitted
//   Base44 sandbox changes to GitHub as a new commit on the default branch.
//   Currently implemented as a status check + advisory; destructive writes are
//   deferred until trusted workflow identity is established.
//
// This function is callable by admins on demand and by the scheduled
// "Connection Sync Engine" workflow when the GitHub registry entry is ACTIVE.

const REPO = 'interplanetarysister/interplanetary-fund2';
const BRANCH = 'main';
const GITHUB_API = 'https://api.github.com';

async function githubRequest(token, method, path, body = null) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'interplanetary-fund-base44-sync/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GitHub API ${path} returned ${res.status}: ${json.message || JSON.stringify(json)}`);
  return json;
}

async function getGitHubToken(base44) {
  try {
    const conn = await base44.connectors?.getConnection?.('github');
    if (conn && conn.accessToken) return conn.accessToken;
  } catch (_) { /* fall through */ }
  return null;
}

// Pull: fetch the current HEAD SHA from GitHub and compare with Base44's known state.
async function syncPull(token, sr) {
  const branch = await githubRequest(token, 'GET', `/repos/${REPO}/branches/${BRANCH}`);
  const remoteSha = branch?.commit?.sha;
  if (!remoteSha) return { ok: false, detail: 'Could not read branch HEAD from GitHub.' };

  // Record the observed SHA in the registry so health checks can detect drift.
  const entries = await sr.entities.PlatformAccessRegistry.filter({ platform: 'github' }).catch(() => []);
  if (entries && entries[0]) {
    await sr.entities.PlatformAccessRegistry.update(entries[0].id, {
      last_verified: new Date().toISOString(),
      description: `HEAD on ${BRANCH}: ${remoteSha.slice(0, 12)} — verified via native GitHub synchronization control`,
    }).catch(() => {});
  }

  return { ok: true, detail: `GitHub HEAD is ${remoteSha.slice(0, 12)} on ${BRANCH}. Full file-level sync is deferred pending trusted workflow identity (see docs/deferred-base44-workflows.md).` };
}

// Push: verify the Base44 sandbox is in sync with GitHub.
// Destructive writes are deferred; this direction currently performs an advisory check.
async function syncPush(token) {
  const branch = await githubRequest(token, 'GET', `/repos/${REPO}/branches/${BRANCH}`);
  const remoteSha = branch?.commit?.sha;
  if (!remoteSha) return { ok: false, detail: 'Could not read branch HEAD from GitHub.' };
  return {
    ok: true,
    detail: `Push advisory: remote HEAD is ${remoteSha.slice(0, 12)}. Destructive push is deferred until trusted workflow identity is established (see docs/deferred-base44-workflows.md). Use git push from the sandbox CLI when ready.`,
  };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));

    const isWorkflow = body.initiator_type === 'workflow' || body.initiator_type === 'scheduled';
    // Scheduled Base44 workflows run service-scoped and may not carry an end-user
    // session. Interactive calls still require an authenticated admin.
    if (!isWorkflow && !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isWorkflow && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin only.' }, { status: 403 });
    }

    const sr = base44.asServiceRole;

    const access = await assertPlatformAccess(sr, 'github');
    if (!access.ok) {
      return Response.json({
        ok: false,
        skipped: true,
        reason: `GitHub integration not accessible: ${access.reason}`,
        status: access.status,
      }, { status: 403 });
    }

    const direction = body.direction || 'both';
    if (!['push', 'pull', 'both'].includes(direction)) {
      return Response.json({ error: 'direction must be "push", "pull", or "both"' }, { status: 400 });
    }

    const token = await getGitHubToken(base44);
    if (!token) {
      return Response.json({
        ok: false,
        reason: 'GitHub OAuth connector not authorized — reconnect in Settings > Integrations.',
      }, { status: 503 });
    }

    const now = new Date().toISOString();
    const results = {};

    if (direction === 'pull' || direction === 'both') {
      results.pull = await syncPull(token, sr);
    }
    if (direction === 'push' || direction === 'both') {
      results.push = await syncPush(token);
    }

    const anySucceeded = Object.values(results).some((r) => r.ok);
    const anyFailed = Object.values(results).some((r) => !r.ok);
    const overall = anyFailed && !anySucceeded ? 'failed' : anySucceeded ? 'partial' : 'failed';
    // Simplified: all ok → success; mix → partial; all failed → failed
    const finalStatus = Object.values(results).every((r) => r.ok) ? 'success' : anySucceeded ? 'partial' : 'failed';

    await logAudit(base44, {
      action: 'github_sync',
      actor_user_id: user?.id ?? null,
      target_type: 'Repository',
      target_id: REPO,
      detail: `direction=${direction} overall=${finalStatus} ${Object.entries(results).map(([k, v]) => `${k}=${v.ok ? 'ok' : 'fail'}`).join(' ')}`,
      status: finalStatus === 'failed' ? 'failure' : 'success',
      metadata: { direction, results, overall: finalStatus },
    });

    if (anyFailed) {
      try {
        const admins = await sr.entities.User.filter({ role: 'admin' }).catch(() => []);
        for (const admin of admins) {
          const failedOps = Object.entries(results).filter(([, v]) => !v.ok).map(([k]) => k).join(', ');
          await sr.entities.Notification.create({
            user_id: admin.id,
            title: '[GitHub Sync] One or more operations failed',
            body: `GitHub sync failed for: ${failedOps}. ${Object.values(results).filter((r) => !r.ok).map((r) => r.detail).join('; ')}`,
            type: 'system',
            link: '/admin/integrations',
          });
        }
      } catch (_) { /* non-fatal */ }
    }

    return Response.json({ ok: !anyFailed, overall: finalStatus, direction, synced_at: now, results });
  } catch (error) {
    console.error('syncGitHub error:', error.message);
    return Response.json({ error: 'GitHub sync could not complete.' }, { status: 500 });
  }
}
