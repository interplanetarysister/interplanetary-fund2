import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';

const FIELDS=['title','summary','story','category','goal_amount','cover_image_url','end_date','location'];
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);

export default async function(req){
  try{
    const base44=createClientFromRequest(req);
    const user=await base44.auth.me().catch(()=>null);
    if(!user) return Response.json({error:'Unauthorized'},{status:401});
    const body=await req.json().catch(()=>({}));
    const sr=base44.asServiceRole;
    const record=await sr.entities.ExternalCampaignImport.get(body.import_id).catch(()=>null);
    if(!record||record.owner_user_id!==user.id) return Response.json({error:'Imported campaign link not found.'},{status:404});
    if(record.sync_enabled!==true) return Response.json({error:'Synchronization is disabled for this imported campaign.'},{status:409});
    const campaign=await sr.entities.Campaign.get(record.campaign_id).catch(()=>null);
    const connection=await sr.entities.PlatformConnection.get(record.connection_id).catch(()=>null);
    if(!campaign||campaign.created_by_id!==user.id||!connection||connection.created_by_id!==user.id||connection.status!=='connected') return Response.json({error:'Campaign connection is not available.'},{status:409});
    const snapshot=body.campaign&&typeof body.campaign==='object'?body.campaign:{};
    const provenance={...(record.field_provenance||{})};
    const locked=new Set(record.locally_locked_fields||[]);
    const patch={};
    const now=new Date().toISOString();
    for(const key of FIELDS){
      if(snapshot[key]===undefined) continue;
      const previous=provenance[key]?.source_value;
      if(previous!==undefined&&!same(campaign[key],previous)) locked.add(key);
      if(locked.has(key)) continue;
      patch[key]=snapshot[key];
      provenance[key]={source:connection.platform,connection_id:connection.id,imported_at:now,source_value:snapshot[key]};
    }
    if(Object.keys(patch).length) await sr.entities.Campaign.update(campaign.id,patch);
    await sr.entities.ExternalCampaignImport.update(record.id,{last_imported_at:now,source_updated_at:String(body.source_updated_at||now),field_provenance:provenance,locally_locked_fields:[...locked],status:'imported'});
    await logAudit(base44,{action:'external_campaign_synced',actor_user_id:user.id,target_type:'Campaign',target_id:campaign.id,detail:'Synchronized unlocked fields from connected external campaign without overwriting local edits.',status:'success',metadata:{platform:connection.platform,connection_id:connection.id,updated_fields:Object.keys(patch),locked_fields:[...locked]}});
    return Response.json({ok:true,campaign_id:campaign.id,updated_fields:Object.keys(patch),locally_locked_fields:[...locked]});
  }catch(error){
    console.error('syncImportedCampaign failed:',error?.message||error);
    return Response.json({error:'Imported campaign synchronization could not complete.'},{status:500});
  }
}