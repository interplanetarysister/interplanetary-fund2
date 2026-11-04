// IFund workflow migration: preserve schedule and event definitions without
// accidentally executing Base44 financial, publishing, or agent functions.
import manifest from './manifest.json' with {type:'json'};
import eligibility from './eligibility.json' with {type:'json'};
const response=(v,status=200)=>Response.json(v,{status,headers:{'cache-control':'no-store'}});
// Inspection only: these plans are not jobs, verified events, or approval grants.
export function previewWorkflows(selector) {
 const entries=manifest.workflows.filter(w=>selector.name ? w.name===selector.name : w.trigger_type==='entity'&&w.entity_name===selector.entity&&w.events.includes(selector.event));
 return {execution:'disabled',executed:false,preview:true,workflows:entries.map(w=>({
  name:w.name,source_sha256:w.sha256,condition:w.condition,
  condition_evaluated:false,trigger_config:w.trigger_config,steps:w.steps,
  eligible_for_activation:false,
  blockers:eligibility.results.find(e=>e.name===w.name)?.reasons||['activation_evidence_missing']
 }))};
}
export default {
 async fetch(req){const u=new URL(req.url);
  if(req.method==='GET'&&u.pathname==='/health')return response({service:'ifund-workflows',alive:true,ready:false,execution:'disabled',workflow_count:manifest.workflows.length});
  if(req.method==='GET'&&u.pathname==='/v1/workflows/catalog')return response({execution:'disabled',workflows:manifest.workflows.map(w=>({name:w.name,trigger_type:w.trigger_type,cron_expression:w.cron_expression,timezone:w.timezone,events:w.events,entity_name:w.entity_name}))});
  if(req.method==='GET'&&u.pathname==='/v1/workflows/readiness')return response({ready:false,execution:'disabled',...eligibility});
  if(req.method==='GET'&&u.pathname==='/v1/workflows/preview'){
   const name=u.searchParams.get('name'),entity=u.searchParams.get('entity'),event=u.searchParams.get('event');
   if((name&&(entity||event))||(!name&&(!entity||!['create','update','delete'].includes(event))))return response({error:'provide_workflow_name_or_entity_and_event',executed:false},400);
   const plan=previewWorkflows({name,entity,event});
   if(name&&!plan.workflows.length)return response({error:'workflow_not_found',executed:false},404);
   return response(plan);
  }
  if(u.pathname.startsWith('/v1/workflows/'))return response({error:'workflow_execution_not_ready',executed:false},503);
  return response({error:'not_found'},404);
 },
 async scheduled(event,env,ctx){console.log(JSON.stringify({service:'ifund-workflows',status:'disabled',cron:event.cron,executed:false}));}
};
