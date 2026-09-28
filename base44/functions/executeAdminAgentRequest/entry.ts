import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';
const ALLOWED=new Set(['chief_of_staff','builder_agent','admin_agent','review_agent','verification_agent']);
export default async function(req) {
  try {
    const base44=createClientFromRequest(req);
    const user=await base44.auth.me().catch(()=>null);
    if(!user) return Response.json({error:'Unauthorized'},{status:401});
    if(user.role!=='admin') return Response.json({error:'Forbidden'},{status:403});
    const body=await req.json().catch(()=>({}));
    const agent=String(body.agent||'chief_of_staff');
    const content=String(body.content||'').trim().slice(0,12000);
    if(!ALLOWED.has(agent)) return Response.json({error:'Agent is not approved.'},{status:400});
    if(!content) return Response.json({error:'Message is required.'},{status:400});
    const requestId=crypto.randomUUID();
    const record=await base44.asServiceRole.entities.AgentActivity.create({campaign_id:'admin:'+user.id,campaign_title:'Platform Development',owner_user_id:user.id,category:'other',action:'development_agent_request',reason:content,result:'Queued for the approved development-agent runtime.',expected_impact:'',recommended_next_actions:[],artifact_type:'none',status:'pending',description:JSON.stringify({agent_id:agent,request_id:requestId,source:'portable_admin_gateway'})});
    await logAudit(base44,{action:'admin_agent_request',actor_user_id:user.id,target_type:'DevelopmentAgent',target_id:agent,detail:'Development-agent request accepted and recorded.',status:'success',metadata:{request_id:requestId,activity_id:record.id}});
    return Response.json({requestId,response:'Request accepted and recorded. Execution will use the configured development-agent runtime when available.',degraded:true,execution_status:'recorded_pending_runtime'});
  } catch(error) {
    console.error('executeAdminAgentRequest error',error?.message||error);
    return Response.json({error:'Unable to process the development-agent request.'},{status:500});
  }
}
