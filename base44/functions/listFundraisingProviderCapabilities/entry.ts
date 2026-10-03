import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SEED = [
  { platform:'gofundme', display_name:'GoFundMe', campaign_import:true, campaign_sync:true, balance_read:true, payout_model:'user_action_required', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, capability_status:'partial', notes:'Campaign import/sync may use verified connection or observation. Automated payout capability must be verified before use.' },
  { platform:'kickstarter', display_name:'Kickstarter', campaign_import:true, campaign_sync:true, balance_read:true, payout_model:'user_action_required', payout_destination_configurable:false, api_transfer:false, authenticated_browser:false, capability_status:'research_required', notes:'Do not automate collection until provider payout capabilities are verified.' },
  { platform:'indiegogo', display_name:'Indiegogo', campaign_import:true, campaign_sync:true, balance_read:true, payout_model:'user_action_required', payout_destination_configurable:false, api_transfer:false, authenticated_browser:false, capability_status:'research_required', notes:'Do not automate collection until provider payout capabilities are verified.' },
  { platform:'fundrazr', display_name:'FundRazr', campaign_import:true, campaign_sync:true, balance_read:true, payout_model:'direct_to_connected_account', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, capability_status:'partial', notes:'Stripe-based routing is a candidate; verify the specific campaign/payment configuration before presenting as automatic.' },
  { platform:'givesendgo', display_name:'GiveSendGo', campaign_import:true, campaign_sync:true, balance_read:true, payout_model:'automatic_payout', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, capability_status:'partial', notes:'Provider transfer configuration must be verified for the recipient before collection.' },
  { platform:'kofi', display_name:'Ko-fi', campaign_import:true, campaign_sync:true, balance_read:true, payout_model:'direct_to_connected_account', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, capability_status:'verified', notes:'Payments route to the creator connected payment account rather than an IFund-held Ko-fi balance.' },
  { platform:'buymeacoffee', display_name:'Buy Me a Coffee', campaign_import:true, campaign_sync:true, balance_read:true, payout_model:'direct_to_connected_account', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, capability_status:'partial', notes:'Connected payout rail model; verify account-specific payout availability.' },
  { platform:'patreon', display_name:'Patreon', campaign_import:true, campaign_sync:true, balance_read:true, payout_model:'user_action_required', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, capability_status:'partial', notes:'Payout methods and holds vary; do not represent collection as automatic without a verified adapter.' },
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