import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';
import { assertPlatformAccess } from '../../shared/integrationRegistry.ts';

// Two-way sync between Base44 sandbox and GitHub.
//
// Direction: Base44 → GitHub (push)
//   Uses the GitHub OAuth connector to obtain a fresh access token, updates
//   the remote URL, then pushes HEAD to origin/main on GitHub.
//
// Direction: GitHub → Base44 (pull)
//   Fetches the latest state from GitHub and fast-forward merges into the
//   working branch. Conflicts (divergent history) are surfaced as errors
//   rather than auto-resolved, so no code is silently overwritten.
//
// The connector's OAuth token is short-lived; this function refreshes the
// remote URL on every call so push/pull always use a valid credential.
//
// Callable by admins on demand (body.direction: "push" | "pull" | "both")
// and by the scheduled "GitHub Sync" workflow (direction defaults to "both").

const REPO = 'interplanetarysister/interplanetary-fund2';
const BRANCH = 'main';

async function getGitHubToken(base44) {
  try {
    const conn = await base44.connectors?.getConnection?.('github');
    if (conn && conn.accessToken) return conn.accessToken;
  } catch (_) { /* fall through */ }
  return null;
}

// Base44 backend functions cannot execute shell commands or mutate the app's
// checked-out git worktree. Keep this compatibility surface fail-closed and
// truthful: repository synchronization must use Base44's native GitHub
// integration, not a simulated backend-side git operation.
async function run(_cmd) {
  return {
    ok: false,
    stdout: '',
    stderr: 'Backend git execution is unavailable on Base44; use the native GitHub synchronization control.',
  };
}

async function setRemoteUrl(token) {
  const url = `https://x-access-token:${token}@github.com/${REPO}.git`;
  await run(`git remote set-url origin '${url}'`);
}

async function syncPull(token) {
  await setRemoteUrl(token);
  const fetch = await run(`git fetch origin ${BRANCH} 2>&1`);
  if (!fetch.ok) return { ok: false, detail: `Fetch failed: ${fetch.stderr || fetch.stdout}` };

  const behind = await run(`git rev-list HEAD..origin/${BRANCH} --count`);
  const count = parseInt(behind.stdout || '0', 10);
  if (count === 0) return { ok: true, detail: 'Base44 already up to date with GitHub.' };

  const merge = await run(`git merge --ff-only origin/${BRANCH} 2>&1`);
  if (merge.ok) return { ok: true, detail: `Fast-forward merged ${count} commit(s) from GitHub into Base44.` };

  return {
    ok: false,
    detail: `Cannot fast-forward: histories have diverged. Manual resolution required. ${merge.stderr || merge.stdout}`,
  };
}

async function syncPush(token) {
  await setRemoteUrl(token);
  await run('git config user.email "base44-sync[bot]@users.noreply.github.com"');
  await run('git config user.name "base44-sync[bot]"');
  const push = await run(`git push origin ${BRANCH}:${BRANCH} 2>&1`);
  if (push.ok) return { ok: true, detail: 'Pushed HEAD to GitHub successfully.' };
  if (
    push.stderr.includes('Everything up-to-date') ||
    push.stdout.includes('Everything up-to-date')
  ) {
    return { ok: true, detail: 'GitHub already up to date — nothing to push.' };
  }
  return { ok: false, detail: `Push failed: ${push.stderr || push.stdout}` };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));

    const isWorkflow = !user && (body.initiator_type === 'workflow' || body.initiator_type === 'scheduled');
    if (!isWorkflow) {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only.' }, { status: 403 });
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
      results.pull = await syncPull(token);
    }
    if (direction === 'push' || direction === 'both') {
      results.push = await syncPush(token);
    }

    const allOk = Object.values(results).every((r) => r.ok);
    const anyFailed = Object.values(results).some((r) => !r.ok);
    const overall = allOk ? 'success' : anyFailed ? 'partial' : 'failed';

    await logAudit(base44, {
      action: 'github_sync',
      actor_user_id: user?.id ?? null,
      target_type: 'Repository',
      target_id: REPO,
      detail: `direction=${direction} overall=${overall} ${Object.entries(results).map(([k, v]) => `${k}=${v.ok ? 'ok' : 'fail'}`).join(' ')}`,
      status: allOk ? 'success' : 'failure',
      metadata: { direction, results, overall },
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

    return Response.json({ ok: allOk, overall, direction, synced_at: now, results });
  } catch (error) {
    console.error('syncGitHub error:', error.message);
    return Response.json({ error: 'GitHub sync could not complete.' }, { status: 500 });
  }
}
