import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const TRANSPORT_PRIORITY = ['oauth','api','webhook','token','authenticated_browser','public_browser','manual'];
const STATIC: Record<string, Record<string, any>> = {
  linkedin:{connect:{preferred_transport:'oauth',connector_type:'linkedin'}},
  facebook:{connect:{preferred_transport:'oauth',connector_type:'facebook_pages'}},
  instagram:{connect:{preferred_transport:'oauth',connector_type:'instagram'}},
  discord:{connect:{preferred_transport:'oauth',connector_type:'discord'}},
  tiktok:{connect:{preferred_transport:'oauth',connector_type:'tiktok'}},
  patreon:{connect:{preferred_transport:'oauth',connector_type:'patreon'}},
  kofi:{connect:{preferred_transport:'webhook',worker_key:'kofiWebhook'}},
  buymeacoffee:{connect:{preferred_transport:'token',worker_key:'buyMeACoffeeApi'}},
  bluesky:{connect:{preferred_transport:'token',worker_key:'blueskyDirect'}},
  mastodon:{connect:{preferred_transport:'token',worker_key:'mastodonDirect'}},
  gofundme:{read_metrics:{preferred_transport:'public_browser',worker_key:'runBrowserConnection'}},
  kickstarter:{read_metrics:{preferred_transport:'public_browser',worker_key:'runBrowserConnection'}},
  indiegogo:{read_metrics:{preferred_transport:'public_browser',worker_key:'runBrowserConnection'}},
  fundrazr:{read_metrics:{preferred_transport:'public_browser',worker_key:'runBrowserConnection'}},
  givesendgo:{read_metrics:{preferred_transport:'public_browser',worker_key:'runBrowserConnection'}},
  spotfund:{read_metrics:{preferred_transport:'public_browser',worker_key:'runBrowserConnection'}},
};
const seedFor=(platform:string,operation:string)=>STATIC[platform]?.[operation]||null;
const order=(r:any)=>[...new Set([r?.preferred_transport,...(Array.isArray(r?.fallback_transports)?r.fallback_transports:[]),...TRANSPORT_PRIORITY].filter(Boolean))];
const clean=(v:unknown,max=300)=>String(v??'').replace(/[\r\n\t]+/g,' ').trim().slice(0,max);

export default async function handler(req: Request) {
  const base44=createClientFromRequest(req);
  try {
    const user=await base44.auth.me();
    if(!user) return Response.json({error:'Unauthorized'},{status:401});
    const body=await req.json().catch(()=>({}));
    const platform=clean(body.platform,80).toLowerCase();
    const operation=clean(body.operation||'connect',80).toLowerCase();
    const result=clean(body.result,30).toLowerCase();
    const transport=clean(body.transport,50).toLowerCase();
    const detail=clean(body.detail,500);
    if(!platform||!operation) return Response.json({error:'platform and operation are required'},{status:400});

    const rows=await base44.asServiceRole.entities.PlatformConnectionRecipe.filter({platform,operation});
    const recipe=rows?.[0]||null;
    const seed=seedFor(platform,operation);

    if(!result){
      const effective=recipe&&recipe.status!=='disabled'?recipe:seed?{platform,operation,status:'probation',...seed}:{platform,operation,status:'probation',preferred_transport:'manual'};
      return Response.json({platform,operation,recipe:effective,transport_order:order(effective),rediscovery_required:effective.status==='stale'});
    }

    if(user.role!=='admin') return Response.json({error:'Admin required to update shared connection recipes'},{status:403});
    if(!new Set(['success','failure','stale']).has(result)||!transport) return Response.json({error:'Valid result and transport are required'},{status:400});

    const now=new Date().toISOString();
    const evidence=[...(recipe?.evidence||[]),{at:now,result,transport,detail}].slice(-25);
    const successCount=Number(recipe?.success_count||0)+(result==='success'?1:0);
    const failures=result==='success'?0:Number(recipe?.consecutive_failure_count||0)+1;
    const nextStatus=result==='stale'||failures>=3?'stale':result==='success'?'proven':(recipe?.status||'probation');
    const data:any={
      platform,operation,recipe_version:Number(recipe?.recipe_version||1),status:nextStatus,
      preferred_transport:result==='success'?transport:(recipe?.preferred_transport||seed?.preferred_transport||transport),
      fallback_transports:recipe?.fallback_transports||[],connector_type:recipe?.connector_type||seed?.connector_type||'',
      worker_key:recipe?.worker_key||seed?.worker_key||'',required_capabilities:recipe?.required_capabilities||[],
      success_count:successCount,consecutive_failure_count:failures,last_verified_at:now,evidence,notes:recipe?.notes||'',
    };
    if(result==='success') data.last_success_at=now; else data.last_failure_at=now;
    const saved=recipe?await base44.asServiceRole.entities.PlatformConnectionRecipe.update(recipe.id,data):await base44.asServiceRole.entities.PlatformConnectionRecipe.create(data);
    return Response.json({platform,operation,learned:true,recipe:saved,transport_order:order(saved),rediscovery_required:saved.status==='stale'});
  } catch(error) {
    console.error('resolvePlatformConnectionRecipe error:',error?.message||error);
    return Response.json({error:'Could not resolve platform connection recipe.'},{status:500});
  }
}
