import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { staticRecipe, orderedTransports } from '../../shared/platformConnectionRecipes.ts';

const OWNER_EMAILS = new Set(['cuddlemeplatonically@gmail.com','interplanetarysister@gmail.com']);
const TRANSPORTS = new Set(['oauth','api','webhook','token','authenticated_browser','public_browser','manual']);
const OPERATIONS = new Set(['connect','read_metrics','publish','account_create']);
const clean = (x: unknown) => String(x ?? '').trim().toLowerCase();
const fail = (error: string, status = 400) => Response.json({ok:false,error},{status,headers:{'Cache-Control':'no-store'}});
const nowISO = () => new Date().toISOString();

export default async function(req: Request) {
  try {
    const b = createClientFromRequest(req);
    const active = await assertActiveAccount(b);
    if (!active.ok) return fail(active.error, active.status);
    const user = active.user;
    // Role AND verified owner identity. This endpoint is never an agent's privilege.
    if (user.role !== 'admin' || !OWNER_EMAILS.has(clean(user.email)))
      return fail('Verified IFund owner required.',403);
    const body = await req.json().catch(() => ({}));
    const mode = clean(body.mode);
    const sr = b.asServiceRole;
    if (mode === 'prepare') {
      const platform = clean(body.platform), operation = clean(body.operation || 'connect');
      const transport = clean(body.transport);
      if (!/^[a-z][a-z0-9_]{0,79}$/.test(platform) || !OPERATIONS.has(operation) || !TRANSPORTS.has(transport))
        return fail('Unknown platform, operation or transport.');
      const recipe = staticRecipe(platform,operation);
      const rows = await sr.entities.PlatformConnectionRecipe.filter({platform,operation});
      if (!recipe && !rows.length) return fail('No registered recipe exists for this provider.',404);
      const existing = rows[0] || null;
      if (existing?.status === 'disabled' || existing?.blocked_routes?.includes(transport))
        return fail('This route is disabled or blocked.',409);
      const allowed = new Set(orderedTransports(existing || recipe));
      if (!allowed.has(transport)) return fail('Route is not among configured candidate methods.',409);
      // Only a route preference, not a proof of provider support, may be changed.
      const expires_at = new Date(Date.now()+10*60*1000).toISOString();
      const pending = await sr.entities.IntegrationChangeRequest.create({
        owner_user_id:user.id,platform,operation,transport,status:'pending',
        expected_recipe_version:Number(existing?.recipe_version || 0),
        created_at:nowISO(),expires_at,
      });
      return Response.json({ok:true,request_id:pending.id,status:'pending',
        expires_at,requires_owner_approval:true,
        preview:{platform,operation,previous_transport:existing?.preferred_transport || recipe?.preferred_transport || null,
          proposed_transport:transport,effect:'Change internal candidate route preference only; does not create an external account, grant scopes, or verify a provider.'}},
        {headers:{'Cache-Control':'no-store'}});
    }
    if (mode === 'status') {
      const id = String(body.request_id || '');
      if (!/^[a-zA-Z0-9_-]{8,120}$/.test(id)) return fail('Request ID required.');
      const pending = await sr.entities.IntegrationChangeRequest.get(id).catch(() => null);
      if (!pending || pending.owner_user_id !== user.id) return fail('Request not found.',404);
      return Response.json({ok:true,request_id:id,status:pending.status,
        platform:pending.platform,operation:pending.operation,transport:pending.transport,
        expires_at:pending.expires_at,result_summary:pending.result_summary || null},
        {headers:{'Cache-Control':'no-store'}});
    }
    if (mode === 'execute') {
      // No atomic compare-and-swap/unique claim facility has been verified in the
      // authoritative Base44 runtime; avoid duplicate concurrent owner mutations.
      return fail('Owner configuration changes require verified one-time approval locking.',503);
    }
    return fail('Supported modes: prepare, status; execute is disabled pending atomic locking.');
  } catch(error) {
    console.error('manageOwnerConnectionConfiguration:',error instanceof Error?error.name:'UnknownError');
    return fail('Unable to process configuration change.',500);
  }
}
