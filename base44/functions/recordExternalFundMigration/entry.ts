import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { logAudit } from "../../shared/auditLog.ts";
import { round2 } from "../../shared/fees.js";

const ALLOWED_METHODS = new Set(["cashapp","paypal","bitcoin"]);
const ALLOWED_SOURCES = new Set(["GoFundMe","Kickstarter","Indiegogo","Facebook","GiveSendGo","CashApp","PayPal","Other"]);

export default async function(req){
  try{
    const base44=createClientFromRequest(req);
    const user=await base44.auth.me().catch(()=>null);
    if(!user) return Response.json({error:"Unauthorized"},{status:401});
    if(user.role!=="admin") return Response.json({error:"Forbidden"},{status:403});
    const body=await req.json().catch(()=>({}));
    const campaignId=String(body.campaign_id||"");
    const sourcePlatform=String(body.source_platform||"");
    const payoutMethod=String(body.payout_method||"");
    const requestId=String(body.request_id||"");
    const gross=round2(Number(body.gross_amount));
    if(!campaignId||!requestId||requestId.length>160) return Response.json({error:"Campaign and request id are required."},{status:400});
    if(!Number.isFinite(gross)||gross<=0||gross>10000000) return Response.json({error:"Migration amount is invalid."},{status:400});
    if(!ALLOWED_SOURCES.has(sourcePlatform)||!ALLOWED_METHODS.has(payoutMethod)) return Response.json({error:"Migration source or payout method is invalid."},{status:400});
    const sr=base44.asServiceRole;
    const campaign=await sr.entities.Campaign.get(campaignId).catch(()=>null);
    if(!campaign?.id||!campaign?.created_by_id) return Response.json({error:"Campaign was not found or has no owner."},{status:404});
    const operationKey=`external-migration:${requestId}`;
    const existing=await sr.entities.Withdrawal.filter({canonical_operation_key:operationKey}).catch(()=>[]);
    if(existing?.length) return Response.json({ok:true,duplicate:true,withdrawal_id:existing[0].id,status:existing[0].status});
    const fee=round2(gross*0.03), net=round2(gross-fee);
    const withdrawal=await sr.entities.Withdrawal.create({
      owner_user_id:campaign.created_by_id,
      campaign_id:campaign.id,
      campaign_title:campaign.title||"",
      gross_amount:gross,
      platform_fee:fee,
      net_amount:net,
      paypal_email:payoutMethod==="paypal"?String(body.payout_destination||""):"",
      status:"under_review",
      canonical_operation_key:operationKey,
      review_note:`External fund migration from ${sourcePlatform}; admin-attested amount. Intended payout method: ${payoutMethod}. Pending independent reconciliation; no provider payout is claimed by this record.`,
    });
    await logAudit(base44,{action:"external_fund_migration_recorded",actor_user_id:user.id,target_type:"Withdrawal",target_id:withdrawal.id,detail:`campaign=${campaign.id} source=${sourcePlatform} gross=${gross} status=under_review`,status:"success",metadata:{operation_key:operationKey}});
    return Response.json({ok:true,duplicate:false,withdrawal_id:withdrawal.id,status:"under_review",gross_amount:gross,platform_fee:fee,net_amount:net});
  }catch(error){
    console.error("recordExternalFundMigration failed",error?.message||error);
    return Response.json({error:"Unable to record this migration safely."},{status:500});
  }
}
