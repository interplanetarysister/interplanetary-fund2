import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';
import { assertPlatformAccess } from '../../shared/integrationRegistry.ts';

// GitHub connection verification used alongside Base44 native source synchronization
// (GitHub REST API via the connected OAuth connector). No shell commands are used;
// every provider request is read-only and credentials never touch the filesystem.
//
// Direction "pull": reads the latest commit SHA on the default branch and records
//   the observation so operators can identify repository drift.
//
// Direction "push": verifies that the configured GitHub destination and branch are
//   reachable. It does not create commits or transfer Base44 source.
//
// Both directions are compatibility labels for an advisory health check. File-level
// source application remains exclusively in Base44's native synchronization path.
//
// This function is callable only by authenticated admins on demand.
// Scheduled execution remains deferred until Base44 exposes a verifiable,
// non-user workflow identity that this function can authenticate server-side.

const REPO = 'interplanetarysister/interplanetary-fund2';
const BRANCH = 'main';
const GITHUB_API = 'https://api.github.com';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function githubRequest(token, method, path, body = null) {
  const retryable = new Set([429, 500, 502, 503, 504]);
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${GITHUB_API}${path}`, {
        method, signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          'User-Agent': 'interplanetary-fund-base44-sync/1.0',
        },
        body: body ? JSON.stringify(body) : undefined,
      }).finally(() => clearTimeout(timeout));
      const json = await res.json().catch(() => ({}));
      if (res.ok) return json;
      const message = json.message || `HTTP ${res.status}`;
      lastError = new Error(`GitHub temporarily returned ${res.status}: ${message}`);
      if (!retryable.has(res.status) || attempt === 3) throw lastError;
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 600 * (2 ** attempt));
    } catch (error) {
      lastError = error;
      const transient = error?.name === 'AbortError' || /fetch|network|temporar|429|50[0234]/i.test(String(error?.message || ''));
      if (!transient || attempt === 3) throw error;
      await sleep(600 * (2 ** attempt));
    }
  }
  throw lastError || new Error('GitHub request failed.');
}

async function getGitHubToken(base44) {
  try {
    const conn = await base44.connectors?.getConnection?.('github');
    if (conn && conn.accessToken) return conn.accessToken;
  } catch (_) { /* fall through */ }
  return null;
}

// Pull compatibility label: observe the current GitHub HEAD and record it.
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

  return { ok: true, detail: `GitHub HEAD is ${remoteSha.slice(0, 12)} on ${BRANCH}. Repository changes are applied only through Base44 native source synchronization.` };
}

// Push compatibility label: verify GitHub destination reachability only.
async function syncPush(token) {
  const branch = await githubRequest(token, 'GET', `/repos/${REPO}/branches/${BRANCH}`);
  const remoteSha = branch?.commit?.sha;
  if (!remoteSha) return { ok: false, detail: 'Could not read branch HEAD from GitHub.' };
  return {
    ok: true,
    detail: `GitHub destination is reachable at ${remoteSha.slice(0, 12)} on ${BRANCH}. Source application remains exclusively in Base44 native source synchronization.`,
  };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin only.' }, { status: 403 });
    }

    // Request fields describe the operation only and never establish identity.
    const body = await req.json().catch(() => ({}));
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
      actor_user_id: user.id,
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
            title: '[GitHub Verification] One or more connection checks failed',
            body: `GitHub connection verification failed for check(s): ${failedOps}. ${Object.values(results).filter((r) => !r.ok).map((r) => r.detail).join('; ')}`,
            type: 'system',
            link: '/admin/integrations',
          });
        }
      } catch (_) { /* non-fatal */ }
    }

    return Response.json({ ok: !anyFailed, overall: finalStatus, direction, checked_at: now, results });
  } catch (error) {
    console.error('syncGitHub verification error:', error.message);
    return Response.json({ error: 'GitHub connection verification could not complete.' }, { status: 500 });
  }
}
