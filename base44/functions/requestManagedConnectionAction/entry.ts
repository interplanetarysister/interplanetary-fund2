import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hasUnifiedOboConsent } from '../../shared/integrationRegistry.ts';
import { hasManagedConnections } from '../../shared/subscriptionEntitlements.ts';

const ACTIONS = new Set(['connect','create_account']);
const clean=(v:unknown,max=300)=>String(v??'').replace(/[\r\n\t]+/g,' ').trim().slice(0,max);

export default async function(req: Request) {
  try {
    const base44=createClientFromRequest(req);
    const user=await base44.auth.me();
    if(!user) return Response.json({error:'Unauthorized'},{status:401});
    const body=await req.json().catch(()=>({}));
    const platform=clean(body.platform,80).toLowerCase();
    const action=clean(body.action,40).toLowerCase();
    if(!platform||!ACTIONS.has(action)) return Response.json({error:'A supported platform action is required.'},{status:400});
    if(!hasUnifiedOboConsent(user)) return Response.json({error:'Turn on IFund help first.'},{status:403});
    if(action==='create_account'&&!hasManagedConnections(user)) {
      return Response.json({error:'Managed account creation is available with an eligible subscription.'},{status:403});
    }

    const operation=action==='create_account'?'account_create':'connect';
    const recipeResponse=await base44.functions.invoke('resolvePlatformConnectionRecipe',{platform,operation});
    const recipeData=recipeResponse?.data||{};
    const transports=Array.isArray(recipeData.transport_order)?recipeData.transport_order:[];
    const usable=transports.filter((t:string)=>t&&t!=='manual');

    // This endpoint is the canonical command boundary. It never pretends that
    // documentation or a candidate route completed an external account action.
    // A concrete executor must verify success before the recipe becomes proven.
    return Response.json({
      accepted:true,
      platform,
      action,
      execution_model:'user_directed_extension',
      command_source:'direct_user_command',
      recipe:recipeData.recipe||null,
      candidate_transports:usable,
      next_candidate:recipeData.next_candidate||usable[0]||null,
      executable_now:false,
      state:usable.length?'route_selected':'route_discovery_required',
      message:usable.length
        ? 'IFund found a possible route. External account creation is not marked complete until that route is executed and verified.'
        : 'IFund needs to find a supported route for this platform before it can complete this command.',
    });
  } catch(error) {
    console.error('requestManagedConnectionAction error:',error?.message||error);
    return Response.json({error:'IFund could not prepare this connection command.'},{status:500});
  }
}
