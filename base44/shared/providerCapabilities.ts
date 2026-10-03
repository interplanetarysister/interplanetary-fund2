// Canonical provider-capability registry. ONE source of truth for what each
// fundraising platform can do, consumed by both the UI (listFundraising-
// ProviderCapabilities) and financial execution (prepare/executeCollectAndWithdraw).
//
// The SEED below is the verified baseline; stored FundraisingProviderCapability
// records override/extend it. Unknown capability NEVER becomes verified
// capability — a platform missing from both SEED and storage resolves to a
// fail-closed observe_only/research_required entry.

export const CAPABILITY_SEED = [
  { platform:'gofundme', display_name:'GoFundMe', campaign_import:false, campaign_sync:false, balance_read:false, payout_model:'user_action_required', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, capability_status:'partial', evidence_url:'https://support.gofundme.com/hc/en-us/articles/360041758152-Transfer-to-a-business-or-organization', notes:'GoFundMe supports recipient/business bank transfer setup, but recipient/decision-maker verification remains provider-controlled. IFund must not represent this as an API-initiated payout.' },
  { platform:'kickstarter', display_name:'Kickstarter', campaign_import:false, campaign_sync:false, balance_read:false, payout_model:'user_action_required', payout_destination_configurable:false, api_transfer:false, authenticated_browser:false, capability_status:'research_required', notes:'Do not automate collection until provider payout capabilities are verified.' },
  { platform:'indiegogo', display_name:'Indiegogo', campaign_import:false, campaign_sync:false, balance_read:false, payout_model:'user_action_required', payout_destination_configurable:false, api_transfer:false, authenticated_browser:false, capability_status:'research_required', notes:'Do not automate collection until provider payout capabilities are verified.' },
  { platform:'fundrazr', display_name:'FundRazr', campaign_import:false, campaign_sync:false, balance_read:false, payout_model:'direct_to_connected_account', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, capability_status:'partial', notes:'Stripe-based routing is a candidate; verify the specific campaign/payment configuration before presenting as automatic.' },
  { platform:'givesendgo', display_name:'GiveSendGo', campaign_import:false, campaign_sync:false, balance_read:false, payout_model:'automatic_payout', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, capability_status:'verified', evidence_url:'https://help.givesendgo.com/portal/en/kb/articles/how-transfers-work-on-givesendgo', notes:'GiveSendGo supports manual full-balance transfers and weekly, bi-weekly, or monthly automatic transfers to the verified recipient bank account.' },
  { platform:'kofi', display_name:'Ko-fi', campaign_import:false, campaign_sync:false, balance_read:false, payout_model:'direct_to_connected_account', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, capability_status:'verified', evidence_url:'https://help.ko-fi.com/hc/en-us/articles/115003980093-How-do-I-get-paid', notes:'Payments route directly to the creator connected PayPal or Stripe account; there is no Ko-fi-held balance for IFund to withdraw.' },
  { platform:'buymeacoffee', display_name:'Buy Me a Coffee', campaign_import:false, campaign_sync:false, balance_read:false, payout_model:'direct_to_connected_account', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, capability_status:'partial', notes:'Connected payout rail model; verify account-specific payout availability.' },
  { platform:'patreon', display_name:'Patreon', campaign_import:false, campaign_sync:false, balance_read:false, payout_model:'automatic_payout', payout_destination_configurable:true, api_transfer:false, authenticated_browser:false, capability_status:'verified', evidence_url:'https://support.patreon.com/hc/en-us/articles/208656246-How-payouts-work', notes:'Patreon supports manual payouts and monthly automatic payouts; payout-method changes can create a five-day hold. IFund should configure/observe this flow rather than claim an API transfer.' },
  { platform:'spotfund', display_name:'Spotfund', campaign_import:false, campaign_sync:false, balance_read:false, payout_model:'user_action_required', payout_destination_configurable:false, api_transfer:false, authenticated_browser:false, capability_status:'research_required', notes:'Campaign discovery is supported from approved public campaign pages; payout automation remains disabled until independently verified.' },
  { platform:'eventbrite', display_name:'Eventbrite', campaign_import:false, campaign_sync:false, balance_read:false, payout_model:'user_action_required', payout_destination_configurable:false, api_transfer:false, authenticated_browser:false, capability_status:'research_required', notes:'Event fundraising activity may be connected, but payout collection remains disabled until provider capabilities are independently verified.' },
  { platform:'custom', display_name:'Custom Campaign URL', campaign_import:false, campaign_sync:false, balance_read:false, payout_model:'observe_only', payout_destination_configurable:false, api_transfer:false, authenticated_browser:false, capability_status:'research_required', notes:'Observation/import only until a provider-specific adapter is verified.' },
];

export const REGISTRY_VERSION = '2026-10-v1';

// A registry assertion is not an executable transfer adapter. Add a provider
// here only after its account-specific transfer implementation, idempotency,
// settlement verification, and negative authorization tests are shipped.
const IMPLEMENTED_TRANSFER_ADAPTERS = new Set<string>([]);
const EVIDENCE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export function hasFreshCapabilityEvidence(capability, now = Date.now()) {
  if (capability?.capability_status !== 'verified' || !capability?.evidence_url || !capability?.evidence_checked_at) return false;
  try {
    if (new URL(capability.evidence_url).protocol !== 'https:') return false;
  } catch {
    return false;
  }
  const checkedAt = new Date(capability.evidence_checked_at).getTime();
  return Number.isFinite(checkedAt) && checkedAt <= now && now - checkedAt <= EVIDENCE_MAX_AGE_MS;
}

export function hasImplementedTransferAdapter(capability, now = Date.now()) {
  return capability?.api_transfer === true && IMPLEMENTED_TRANSFER_ADAPTERS.has(String(capability.platform || '').toLowerCase()) && hasFreshCapabilityEvidence(capability, now);
}

// Fail-closed fallback for any platform not present in the SEED or storage.
// Unknown capability must never be treated as verified.
const FALLBACK_CAPABILITY = {
  platform: '',
  display_name: '',
  campaign_import: false,
  campaign_sync: false,
  balance_read: false,
  payout_model: 'observe_only',
  payout_destination_configurable: false,
  api_transfer: false,
  authenticated_browser: false,
  capability_status: 'research_required',
  notes: 'Provider capability has not been registered; treated as unsupported.',
};

// Merges the SEED baseline with stored FundraisingProviderCapability records.
// Stored values override SEED defaults so admin edits are authoritative. A
// platform present only in storage (not in the SEED) is included as-is.
// Callers receive the same canonical interpretation the UI shows.
export async function resolveCapabilities(sr) {
  const stored = await sr.entities.FundraisingProviderCapability.list('display_name', 1000).catch(() => []);
  const map = new Map(CAPABILITY_SEED.map((x) => [x.platform, { ...x }]));
  for (const row of stored || []) {
    const base = map.get(row.platform) || { ...FALLBACK_CAPABILITY, platform: row.platform, display_name: row.display_name || row.platform };
    map.set(row.platform, { ...base, ...row });
  }
  return [...map.values()].map((capability) => {
    if (capability.capability_status !== 'verified' || hasFreshCapabilityEvidence(capability)) return capability;
    return {
      ...capability,
      capability_status: 'partial',
      notes: `${capability.notes || ''} Financial capability evidence is missing or stale; transfer eligibility remains disabled.`.trim(),
    };
  });
}

// Resolves a single platform's capability. Returns the fail-closed fallback
// when the platform is unknown to both SEED and storage.
export async function resolveCapabilityForPlatform(sr, platform) {
  const key = String(platform || '').toLowerCase();
  const all = await resolveCapabilities(sr);
  const found = all.find((c) => String(c.platform).toLowerCase() === key);
  if (found) return found;
  return { ...FALLBACK_CAPABILITY, platform: key, display_name: key };
}

// Builds a platform→capability lookup Map for batch financial consumers.
export async function resolveCapabilityMap(sr) {
  const all = await resolveCapabilities(sr);
  return new Map(all.map((c) => [String(c.platform).toLowerCase(), c]));
}
