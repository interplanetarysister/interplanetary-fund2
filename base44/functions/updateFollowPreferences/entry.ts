import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
const KEYS=new Set(['updates','media','milestones','goal_reached','nearing_completion','comments','volunteer','events','emergencies','completed']);
export default async function(req){
 try{const base44=createClientFromRequest(req);const user=await base44.auth.me();if(!user)return Response.json({error:'Authentication required'},{status:401});
 const body=await req.json().catch(()=>({}));const id=String(body?.follow_id||'').trim();const prefs=body?.notification_prefs;
 if(!id||!prefs||typeof prefs!=='object'||Array.isArray(prefs)||Object.keys(prefs).some(k=>!KEYS.has(k)||typeof prefs[k]!=='boolean'))return Response.json({error:'Invalid preferences'},{status:400});
 const rows=await base44.asServiceRole.entities.FollowedCampaign.filter({id});const follow=rows?.[0];if(!follow)return Response.json({error:'Follow not found'},{status:404});
 if(follow.user_id!==user.id)return Response.json({error:'Not authorized'},{status:403});
 await base44.asServiceRole.entities.FollowedCampaign.update(id,{notification_prefs:prefs});return Response.json({ok:true,follow:{...follow,notification_prefs:prefs}});
 }catch(error){console.error('updateFollowPreferences failed:',error?.name||'UnknownError');return Response.json({error:'Notification preferences could not be updated safely.'},{status:500});}
}