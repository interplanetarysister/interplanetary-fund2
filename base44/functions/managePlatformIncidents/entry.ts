import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { logAudit } from '../../shared/auditLog.ts';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { checkRateLimit } from '../../shared/rateLimit.ts';

// Frontend reports are untrusted evidence, NOT instructions for an agent.
// Reporting is also available on login/public pages. Every privileged mode
// independently verifies the current server-authenticated super-admin owner.
const OWNER_EMAILS = new Set(['cuddlemeplatonically@gmail.com','interplanetarysister@gmail.com']);
const canReview = (u:any) => u?.role === 'admin' && OWNER_EMAILS.has(String(u?.email||'').trim().toLowerCase());
const clean = (value:any,n=400) => String(value??'')
  .replace(/https?:\/\/\S+/gi,'[url]')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]')
  .replace(/(bearer|token|apikey|password|authorization|secret)\s*[:=]\s*[^\s,;]+/gi,'[redacted]')
  .replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,n);
const allowedKinds=new Set(['render','promise','script','resource','request','page_load','other']);
const allowedSources=new Set(['error_boundary','window_error','unhandled_rejection','page_error','app_request','app_startup']);
const routeOf=(value:any)=>{
  const valueStr=String(value??'').split(/[?#]/,1)[0];
  if(!valueStr.startsWith('/')||valueStr.startsWith('//'))return '/unknown';
  const section=valueStr.split('/')[1]?.toLowerCase()||'home';
  const allowed=new Set(['home','about','login','register','forgot-password','reset-password','dashboard','create','campaign','discover','social','community','blogs','help','u','profile','agents','connections','admin','subscriptions','withdrawals','giving','inbox','communications','onboarding','mission','ops','analytics','platform','connect','external-accounts','devices','donors','ledger','institutions','my-blog','following','notifications','contact','globe','oauth','activate','embed']);
  if(!allowed.has(section))return '/other';
  return '/'+section+(valueStr.split('/').filter(Boolean).length>1?'/:detail':'');
};
const publicIncident=(p:any)=>({
  id:p.id,route_pattern:p.route_pattern,error_kind:p.error_kind,error_summary:p.error_summary,
  occurrences:p.occurrences,first_seen_at:p.first_seen_at,last_seen_at:p.last_seen_at,
  status:p.status,analysis:p.analysis,systemic_scope:p.systemic_scope,repair_plan:p.repair_plan,
  verification_plan:p.verification_plan,rollback_plan:p.rollback_plan,approval_note:p.approval_note,
  approved_at:p.approved_at,builder_task_id:p.builder_task_id,
  dispatch_error:p.dispatch_error,verification_evidence:p.verification_evidence
});
const sha=async(t:string)=>{
 const bytes=new TextEncoder().encode(t);
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('').slice(0,40);
};
export default async function(req:Request){
  try{
    const base44=createClientFromRequest(req);
    const body=await req.json().catch(()=>({}));
    const mode=clean(body.mode||'report',24);
    const sr=base44.asServiceRole;
    if(mode==='report'){
      const source=clean(body.source||'app_request',32);
      const kind=clean(body.kind||'other',24);
      if(!allowedSources.has(source)||!allowedKinds.has(kind))return Response.json({error:'Unsupported report'},{status:400});
      const route=routeOf(body.route);
      const rawCode=clean(body.code||'FrontendError',80).replace(/[^a-z0-9_. -]/gi,'').slice(0,70);
      const code=new Set(['Error','TypeError','ReferenceError','SyntaxError','RangeError','NetworkError','TimeoutError','ChunkLoadError','ResourceLoadError','FrontendError','RequestError']).has(rawCode)?rawCode:'FrontendError';
      const allowance=await checkRateLimit(base44,'platform_incident_reports_global',240,60);
      if(!allowance.allowed)return Response.json({ok:true,recorded:false,reason:'rate_limited'});
      const summary=clean(body.summary||'Frontend failure',220);
      const fingerprint=await sha([route,source,kind,code].join(':'));
      const prior=await sr.entities.PlatformIncident.filter({fingerprint},'-last_seen_at',5);
      const active=(prior||[]).find((p:any)=>!['verified_fixed','rejected'].includes(p.status));
      const now=new Date().toISOString();
      if(active){
        // Aggregate per-minute to limit anonymous report floods. Never reset a
        // reviewed plan on repeat events, and do not infer successful recovery.
        if(Date.now()-new Date(active.last_seen_at||0).getTime()>60000){
          await sr.entities.PlatformIncident.update(active.id,{
            occurrences:Math.max(0,Number(active.occurrences)||0)+1,last_seen_at:now
          });
        }
        return Response.json({ok:true,recorded:true},{headers:{'Cache-Control':'no-store'}});
      }
      // Avoid storing account IDs, URLs, tokens, raw stack traces or payloads.
      await sr.entities.PlatformIncident.create({
        fingerprint,source,route_pattern:route,error_kind:kind,error_summary:summary||code,
        affected_routes:[route],occurrences:1,first_seen_at:now,last_seen_at:now,status:'needs_review',
        analysis:'Unverified client report. Audit the shared component, network path, server logs and any related incidents before determining root cause.',
        systemic_scope:'Check other routes and features using this shared component or backend interface.',
        repair_plan:'Identify and fix the common underlying cause, not just this session; test every affected web/mobile workflow.',
        verification_plan:'Reproduce the failure; add regression tests for affected routes, access levels and device layouts; verify backend requests and live behavior.',
        rollback_plan:'Use a versioned checkpoint and restore the last verified build if the release regresses.',
      });
      return Response.json({ok:true,recorded:true},{headers:{'Cache-Control':'no-store'}});
    }

    const guard=await assertActiveAccount(base44);
    if(!guard.ok)return Response.json({error:guard.error},{status:guard.status});
    const user=guard.user;
    if(!canReview(user))return Response.json({error:'Super-admin review required'},{status:403});
    if(mode==='list'){
      const records=await sr.entities.PlatformIncident.list('-last_seen_at',120);
      return Response.json({ok:true,incidents:(records||[]).map(publicIncident)});
    }
    const id=clean(body.incident_id,90);
    const incident=await sr.entities.PlatformIncident.get(id).catch(()=>null);
    if(!incident)return Response.json({error:'Incident unavailable'},{status:404});
    if(mode==='save_plan'){
      if(['approved_queued','builder_dispatched','verified_fixed'].includes(incident.status))
        return Response.json({error:'This plan is already approved and cannot be silently changed'},{status:409});
      const patch={
        analysis:clean(body.analysis,1600),systemic_scope:clean(body.systemic_scope,1600),
        repair_plan:clean(body.repair_plan,2800),verification_plan:clean(body.verification_plan,1400),
        rollback_plan:clean(body.rollback_plan,1000),status:'plan_ready'
      };
      if([patch.analysis,patch.systemic_scope,patch.repair_plan,patch.verification_plan,patch.rollback_plan].some(x=>x.length<18))
        return Response.json({error:'A root-cause investigation, platform-wide scope, fix, verification and rollback plan are required'},{status:400});
      const saved=await sr.entities.PlatformIncident.update(id,patch);
      await logAudit(base44,{action:'platform_fix_plan_updated',actor_user_id:user.id,target_type:'PlatformIncident',target_id:id,status:'success'});
      return Response.json({ok:true,incident:publicIncident(saved)});
    }
    if(mode==='reject'){
      if(incident.builder_task_id)return Response.json({error:'Already dispatched; handle as a separate cancellation'},{status:409});
      const patched=await sr.entities.PlatformIncident.update(id,{status:'rejected',approval_note:clean(body.note,500)});
      await logAudit(base44,{action:'platform_fix_plan_rejected',actor_user_id:user.id,target_type:'PlatformIncident',target_id:id,status:'success'});
      return Response.json({ok:true,incident:publicIncident(patched)});
    }
    if(mode!=='approve')return Response.json({error:'Unsupported operation'},{status:400});
    if(incident.builder_task_id)return Response.json({ok:true,incident:publicIncident(incident),already_dispatched:true});
    if(incident.status!=='plan_ready')return Response.json({error:'Save a complete reviewed plan before approval'},{status:409});
    const now=new Date().toISOString();
    const task=await sr.entities.AgentDelegation.create({
      owner_user_id:user.id,source_agent:'platform_incident_audit',destination_agent:'admin_builder_agent',
      objective:'Implement the approved platform-wide correction for incident '+id,
      context_summary: [
        'Incident ID: '+id,'Route: '+incident.route_pattern,'Error type: '+incident.error_kind,
        'Investigation: '+incident.analysis,'Shared scope: '+incident.systemic_scope,
        'Implementation plan: '+incident.repair_plan,'Verification: '+incident.verification_plan,
        'Rollback: '+incident.rollback_plan,
        'Do not change other users or claim implementation without an authorized executing builder, source diff and verification evidence.'
      ].join('\n').slice(0,9000),
      status:'requested',result_summary:'Approved fix plan queued for builder implementation; no code has been changed by approval.',
      verification:'Pending code diff, automated tests and deployment verification.',
      created_at:now,updated_at:now,
    });
    await sr.entities.PlatformIncident.update(id,{
      status:'approved_queued',approved_by_user_id:user.id,approved_at:now,
      approval_note:clean(body.note,500),builder_task_id:task.id,dispatch_error:''
    });
    await logAudit(base44,{action:'platform_fix_plan_approved',actor_user_id:user.id,target_type:'PlatformIncident',target_id:id,detail:'Builder task '+task.id,status:'success'});
    // Dispatch to native agent runtime, not a browser or unapproved external API.
    // The present admin_builder_agent can triage and queue; code writing needs
    // a separately authorized executor. A conversation is NOT deployment.
    try{
      const conversation=await base44.agents.createConversation({
        agent_name:'admin_builder_agent',metadata:{name:'Approved platform repair',source:'platform_incident_audit',incident_id:id,task_id:task.id}
      });
      await base44.agents.addMessage(conversation,{role:'user',
        content:'An authorized super-admin approved incident '+id+' and task '+task.id+'. Review the approved platform-wide plan in the task context. Do not queue duplicates or claim code was changed unless independently verified. Plan: '+String(incident.repair_plan).slice(0,1800)
      });
      await sr.entities.AgentDelegation.update(task.id,{status:'assigned',result_summary:'Builder conversation dispatched; awaiting actual implementation evidence.',updated_at:new Date().toISOString()});
      await sr.entities.PlatformIncident.update(id,{status:'builder_dispatched',builder_conversation_id:conversation.id});
      return Response.json({ok:true,task_id:task.id,dispatched:true,implemented:false});
    }catch{
      await sr.entities.PlatformIncident.update(id,{dispatch_error:'Builder conversation could not start; task remains queued.'});
      return Response.json({ok:true,task_id:task.id,dispatched:false,implemented:false});
    }
  }catch(error){
    console.error('managePlatformIncidents:',error instanceof Error?error.name:'Error');
    return Response.json({error:'Platform incident request could not be completed'},{status:500});
  }
}
