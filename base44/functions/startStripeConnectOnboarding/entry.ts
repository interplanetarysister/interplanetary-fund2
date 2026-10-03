import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { logAudit } from '../../shared/auditLog.ts';

const allowedOrigins=()=>new Set([
  'https://interplanetaryfund.com',
  'https://www.interplanetaryfund.com',
  'https://interplanetaryfund.base44.app',
  'https://interplanetary-fund2.interplanetary-fund.workers.dev',
  ...String(secrets.get('PUBLIC_APP_ORIGINS')||'').split(',').map(v=>v.trim()).filter(Boolean),
].map(v=>{try{return new URL(v).origin}catch{return ''}}).filter(Boolean));

export default async function(req){
  try{
    const base44=createClientFromRequest(req);
    const user=await base44.auth.me().catch(()=>null);
    if(!user) return Response.json({error:'Unauthorized'},{status:401});
    const body=await req.json().catch(()=>({}));
    let origin='';
    try{origin=new URL(String(body.origin||'')).origin}catch{}
    if(!allowedOrigins().has(origin)) return Response.json({error:'Invalid application origin.'},{status:400});
    const key=secrets.get('STRIPE_SECRET_KEY');
    if(!key||!String(key).startsWith('sk_live_')) return Response.json({error:'Connected payout account onboarding is not currently available.'},{status:503});
    const stripe=new Stripe(key);
    const sr=base44.asServiceRole;
    const rows=await sr.entities.ConnectedPayoutAccount.filter({owner_user_id:user.id,provider:'stripe_connect'},'-updated_date',5).catch(()=>[]);
    let record=rows[0]||null;
    let accountId=record?.provider_account_id||'';
    if(!accountId){
      const account=await stripe.accounts.create({
        type:'express',
        metadata:{ifund_user_id:user.id},
      },{idempotencyKey:`ifund-connect-account:${user.id}`});
      accountId=account.id;
      record=await sr.entities.ConnectedPayoutAccount.create({
        owner_user_id:user.id,provider:'stripe_connect',provider_account_id:accountId,status:'onboarding',
        charges_enabled:!!account.charges_enabled,payouts_enabled:!!account.payouts_enabled,
        details_submitted:!!account.details_submitted,default_currency:String(account.default_currency||'').toUpperCase(),
        country:String(account.country||'')
      });
    }
    const link=await stripe.accountLinks.create({
      account:accountId,
      refresh_url:`${origin}/withdrawals?connect=refresh`,
      return_url:`${origin}/withdrawals?connect=return`,
      type:'account_onboarding',
    });
    await logAudit(base44,{action:'stripe_connect_onboarding_started',actor_user_id:user.id,target_type:'ConnectedPayoutAccount',target_id:record.id,detail:'Owner started Stripe Connect onboarding for an IFund-managed payout account.',status:'success',metadata:{provider:'stripe_connect'}});
    return Response.json({ok:true,url:link.url,account_status:record.status});
  }catch(error){
    console.error('startStripeConnectOnboarding failed:',error?.message||error);
    return Response.json({error:'Connected payout account onboarding could not be started.'},{status:500});
  }
}