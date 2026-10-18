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
    if (mode === 'execute') {
      const id=String(body.request_id || '');
      if (!/^[a-zA-Z0-9_-]{8,120}$/.test(id) || body.confirm !== true) return fail('Explicit owner confirmation and request ID required.');
      const pending = await sr.entities.IntegrationChangeRequest.get(id).catch(()=>null);
      if (!pending || pending.owner_user_id !== user.id) return fail('Request not found.',404);
      if (pending.status !== 'pending') return fail('This request has already been processed.',409);
      if (Date.parse(pending.expires_at) <= Date.now()) {
        await sr.entities.IntegrationChangeRequest.update(id,{status:'expired'});
        return fail('Request expired. Prepare a new change.',409);
      }
      const {platform,operation,transport}=pending;
      if (!OPERATIONS.has(operation) || !TRANSPORTS.has(transport)) return fail('Invalid pending operation.',409);
      const rows=await sr.entities.PlatformConnectionRecipe.filter({platform,operation});
      const existing=rows[0] || null;
      const fallback=staticRecipe(platform,operation);
      if (!existing && !fallback) return fail('Recipe no longer exists.',409);
      if (Number(existing?.recipe_version || 0) !== Number(pending.expected_recipe_version))
        return fail('Provider route changed since preparation. Review again.',409);
      if (existing?.status === 'disabled' || existing?.blocked_routes?.includes(transport))
        return fail('Provider route is blocked.',409);
      if (!orderedTransports(existing || fallback).includes(transport))
        return fail('Selected method is no longer available.',409);
      const update={preferred_transport:transport,
        recipe_version:Number(existing?.recipe_version || 0)+1,
        status:'probation',discovery_state:'probation'};
      if (existing) await sr.entities.PlatformConnectionRecipe.update(existing.id,update);
      else await sr.entities.PlatformConnectionRecipe.create({
        platform,operation,...fallback,...update,
      });
      await sr.entities.IntegrationChangeRequest.update(id,{
        status:'applied',approved_at:nowISO(),applied_at:nowISO(),
        result_summary:'IFund internal route preference updated; provider connection remains unverified.',
      });
      return Response.json({ok:true,status:'applied',platform,operation,
        verified_connection:false,external_provider_modified:false},
        {headers:{'Cache-Control':'no-store'}});
    }
    return fail('Supported modes: prepare, execute.');
  } catch(error) {
    console.error('manageOwnerConnectionConfiguration:',error instanceof Error?error.name:'UnknownError');
    return fail('Unable to process configuration change.',500);
  }
}
