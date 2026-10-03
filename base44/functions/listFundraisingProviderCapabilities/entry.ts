import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SEED = [
  { platform:'gofundme', display_name:'GoFundMe', campaign_import:true, campaign_sync:true, balance_read:true, payout_model:'user_action_required', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, capability_status:'verified', evidence_url:'https://support.gofundme.com/hc/en-us/articles/360041758152-Transfer-to-a-business-or-organization', notes:'GoFundMe supports recipient/business bank transfer setup, but recipient/decision-maker verification remains provider-controlled. IFund must not represent this as an API-initiated payout.' },
  { platform:'kickstarter', display_name:'Kickstarter', campaign_import:true, campaign_sync:true, balance_read:true, payout_model:'user_action_required', payout_destination_configurable:false, api_transfer:false, authenticated_browser:false, capability_status:'research_required', notes:'Do not automate collection until provider payout capabilities are verified.' },
  { platform:'indiegogo', display_name:'Indiegogo', campaign_import:true, campaign_sync:true, balance_read:true, payout_model:'user_action_required', payout_destination_configurable:false, api_transfer:false, authenticated_browser:false, capability_status:'research_required', notes:'Do not automate collection until provider payout capabilities are verified.' },
  { platform:'fundrazr', display_name:'FundRazr', campaign_import:true, campaign_sync:true, balance_read:true, payout_model:'direct_to_connected_account', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, capability_status:'partial', notes:'Stripe-based routing is a candidate; verify the specific campaign/payment configuration before presenting as automatic.' },
  { platform:'givesendgo', display_name:'GiveSendGo', campaign_import:true, campaign_sync:true, balance_read:true, payout_model:'automatic_payout', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, capability_status:'verified', evidence_url:'https://help.givesendgo.com/portal/en/kb/articles/how-transfers-work-on-givesendgo', notes:'GiveSendGo supports manual full-balance transfers and weekly, bi-weekly, or monthly automatic transfers to the verified recipient bank account.' },
  { platform:'kofi', display_name:'Ko-fi', campaign_import:true, campaign_sync:true, balance_read:true, payout_model:'direct_to_connected_account', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, capability_status:'verified', evidence_url:'https://help.ko-fi.com/hc/en-us/articles/115003980093-How-do-I-get-paid', notes:'Payments route directly to the creator connected PayPal or Stripe account; there is no Ko-fi-held balance for IFund to withdraw.' },
  { platform:'buymeacoffee', display_name:'Buy Me a Coffee', campaign_import:true, campaign_sync:true, balance_read:true, payout_model:'direct_to_connected_account', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, capability_status:'partial', notes:'Connected payout rail model; verify account-specific payout availability.' },
  { platform:'patreon', display_name:'Patreon', campaign_import:true, campaign_sync:true, balance_read:true, payout_model:'automatic_payout', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, capability_status:'verified', evidence_url:'https://support.patreon.com/hc/en-us/articles/208656246-How-payouts-work', notes:'Patreon supports manual payouts and monthly automatic payouts; payout-method changes can create a five-day hold. IFund should configure/observe this flow rather than claim an API transfer.' },
  { platform:'custom', display_name:'Custom Campaign URL', campaign_import:true, campaign_sync:false, balance_read:false, payout_model:'observe_only', payout_destination_configurable:false, api_transfer:false, authenticated_browser:false, capability_status:'research_required', notes:'Observation/import only until a provider-specific adapter is verified.' }
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error:'Unauthorized' }, { status:401 });
    const sr = base44.asServiceRole;
    const stored = await sr.entities.FundraisingProviderCapability.list('display_name', 1000).catch(() => []);
    const map = new Map(SEED.map((x) => [x.platform, x]));
    for (const row of stored || []) map.set(row.platform, { ...(map.get(row.platform)||{}), ...row });
    return Response.json({ providers:[...map.values()], registry_version:'2026-10-v1' });
  } catch (error) {
    console.error('listFundraisingProviderCapabilities failed:', error?.message || error);
    return Response.json({ error:'Could not load fundraising provider capabilities.' }, { status:500 });
  }
}