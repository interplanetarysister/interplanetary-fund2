import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  adminRecipeView,
  recipeKey,
  safeRecipeFailure,
  sanitizedCapability,
} from '../../shared/platformConnectionRecipePolicy.js';

export default async function handler(req: Request) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const platform = recipeKey(body?.platform);
    const operation = recipeKey(body?.operation || 'connect');
    if (!platform || !operation) {
      return Response.json({ error: 'A valid platform and operation are required.' }, { status: 400 });
    }

    const rows = await base44.asServiceRole.entities.PlatformConnectionRecipe.filter({ platform, operation });
    if (!Array.isArray(rows) || rows.length > 10) {
      return Response.json({ error: 'Connection method data is unavailable.' }, { status: 502 });
    }
    const recipe = rows[0] || null;
    const result = typeof body?.result === 'string' ? body.result.trim().toLowerCase() : '';

    if (!result) {
      if (user.role !== 'admin') {
        return Response.json(sanitizedCapability(recipe, platform, operation));
      }
      return Response.json(adminRecipeView(recipe, platform, operation));
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin required to update shared connection methods.' }, { status: 403 });
    }
    // An admin assertion is not provider/runtime proof. Successful recipes may
    // only be written by a future server-owned evidence verifier, not this
    // caller-controlled endpoint.
    if (result === 'success') {
      return Response.json({ error: 'Provider evidence is required before a connection method can be marked proven.' }, { status: 409 });
    }
    if (!recipe) return Response.json({ error: 'Connection method not found.' }, { status: 404 });

    const failure = safeRecipeFailure(result, body?.transport, body?.failure_code);
    if (!failure) return Response.json({ error: 'A valid failure result is required.' }, { status: 400 });

    const now = new Date().toISOString();
    const priorEvidence = Array.isArray(recipe.evidence) ? recipe.evidence.slice(-24) : [];
    const failures = Math.min(1_000_000, Math.max(0, Number(recipe.consecutive_failure_count) || 0) + 1);
    const status = result === 'stale' || failures >= 3 ? 'stale' : 'probation';
    const saved = await base44.asServiceRole.entities.PlatformConnectionRecipe.update(recipe.id, {
      status,
      consecutive_failure_count: failures,
      last_failure_at: now,
      last_verified_at: now,
      evidence: [...priorEvidence, { at: now, result, transport: failure.transport, detail: failure.code }],
    });
    return Response.json({
      platform,
      operation,
      learned: false,
      recorded_failure: true,
      ...adminRecipeView(saved, platform, operation),
    });
  } catch (error) {
    console.error('resolvePlatformConnectionRecipe error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Could not resolve platform connection method.' }, { status: 500 });
  }
}
