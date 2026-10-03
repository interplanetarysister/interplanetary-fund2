import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';

export default async function(req){
  try{
    const base44=createClientFromRequest(req);
    const user=await base44.auth.me().catch(()=>null);
    if(!user) return Response.json({error:'Unauthorized'},{status:401});
    const sr=base44.asServiceRole;
    const rows=await sr.entities.ConnectedPayoutAccount.filter({owner_user_id:user.id,provider:'stripe_connect'},'-updated_date',5).catch(()=>[]);
    const record=rows[0]||null;
    if(!record) return Response.json({ok:true,configured:false,status:'not_started'});
    const key=secrets.get('STRIPE_SECRET_KEY');
    if(!key||!String(key).startsWith('sk_live_')) return Response.json({ok:true,configured:true,status:record.status,payouts_enabled:false,provider_available:false});
    const stripe=new Stripe(key);
    const account=await stripe.accounts.retrieve(record.provider_account_id);
    const status=account.payouts_enabled&&account.details_submitted?'ready':account.details_submitted?'restricted':'onboarding';
    const patch={status,charges_enabled:!!account.charges_enabled,payouts_enabled:!!account.payouts_enabled,details_submitted:!!account.details_submitted,default_currency:String(account.default_currency||'').toUpperCase(),country:String(account.country||''),last_verified_at:new Date().toISOString(),last_error:''};
    await sr.entities.ConnectedPayoutAccount.update(record.id,patch);
    return Response.json({ok:true,configured:true,status,...patch,provider:'stripe_connect'});
  }catch(error){
    console.error('getConnectedPayoutAccount failed:',error?.message||error);
    return Response.json({error:'Connected payout account status could not be verified.'},{status:500});
  }
}