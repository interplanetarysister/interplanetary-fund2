import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req){
 try{
  const base44=createClientFromRequest(req);const user=await base44.auth.me();if(!user)return Response.json({error:'Authentication required'},{status:401});
  const b=await req.json().catch(()=>({}));const campaignId=String(b?.campaign_id||'').trim(),connectionId=String(b?.connection_id||'').trim(),content=String(b?.content||'').trim();
  if(!campaignId||!connectionId||!content||content.length>10000)return Response.json({error:'Invalid post request'},{status:400});
  const [campaigns,connections]=await Promise.all([base44.asServiceRole.entities.Campaign.filter({id:campaignId}),base44.asServiceRole.entities.PlatformConnection.filter({id:connectionId})]);
  const campaign=campaigns?.[0],connection=connections?.[0];if(!campaign||!connection)return Response.json({error:'Campaign or connection not found'},{status:404});
  if(campaign.created_by_id!==user.id&&user.role!=='admin')return Response.json({error:'Not authorized for campaign'},{status:403});
  if(connection.created_by_id!==user.id&&connection.user_id!==user.id&&user.role!=='admin')return Response.json({error:'Not authorized for connection'},{status:403});
  if(connection.campaign_id&&connection.campaign_id!==campaignId)return Response.json({error:'Connection does not belong to this campaign'},{status:409});
  const post=await base44.entities.DistributedPost.create({campaign_id:campaignId,campaign_title:campaign.title,connection_id:connectionId,platform:connection.platform,content,status:'pending_approval'});
  return Response.json({ok:true,post});
 }catch(error){console.error('createDistributedPost failed:',error?.name||'UnknownError');return Response.json({error:'Distributed post could not be created safely.'},{status:500});}
}
