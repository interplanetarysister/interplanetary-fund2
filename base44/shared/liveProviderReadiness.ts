import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { FEATURE_SCOPES, CODE_CONNECTED_FEATURES } from './featureFlagGate.ts';
import { isLivePayPalRestReady, isLivePayPalPayoutReady } from './paypal.ts';

// A connection, secret, or administrative toggle alone never means that real
// donations, payouts, posting, or agent execution are operational.
export const LIVE_FEATURE_NAMES: Record<string, string> = {
  public_campaign_fundraising: 'Campaign donations',
  payment_checkout_enabled: 'Donation checkout',
  paypal_checkout: 'PayPal payments',
  google_pay_checkout: 'Google Pay',
  stripe_checkout: 'Stripe card payments',
  recurring_donations: 'Monthly giving',
  subscription_checkout: 'Subscriptions',
  outbound_payout_execution: 'Campaign withdrawals',
  ai_campaign_assistant: 'AI campaign assistance',
  ai_outreach_agent: 'AI outreach',
  social_autopilot: 'Social posting assistant',
  cross_platform_publishing: 'Cross-platform publishing',
  managed_connections: 'Connected accounts',
  external_campaign_import: 'Campaign imports',
  external_fund_collection: 'External fundraiser collections',
  external_feed_mirroring: 'External activity feed',
  community_creation: 'Community creation',
  institution_programs: 'Institution programs',
  admin_agent_execution: 'Admin agent execution',
  crypto_donations: 'Cryptocurrency donations',
};

const settled = (ready: boolean, explanation: string) => ({ ready, explanation });
function stripeEnabledEvents(endpoint: any): boolean {
  const events = new Set(endpoint?.enabled_events || []);
  return endpoint?.status === 'enabled' && (events.has('*') ||
    ['checkout.session.completed','invoice.paid','customer.subscription.updated','customer.subscription.deleted'].every(e => events.has(e)));
}
function stripeWebhookMatches(endpoint: any): boolean {
  const url = String(endpoint?.url || '').toLowerCase();
  return url.includes('stripewebhook') && (url.includes('6a67a778342a8fe05ee79cba') || url.includes('interplanetaryfund'));
}

export async function probeLiveProviders() {
  const payPalId = secrets.get('PAYPAL_CLIENT_ID');
  const payPalSecret = secrets.get('PAYPAL_CLIENT_SECRET');
  const payPalConfigured = !!(payPalId && payPalSecret && secrets.get('PAYPAL_MODE') === 'live');
  let paypal = false;
  let payouts = false;
  if (payPalConfigured) {
    try {
      paypal = await isLivePayPalRestReady();
      if (paypal) payouts = await isLivePayPalPayoutReady();
    } catch (_) { /* Fail closed. */ }
  }
  const stripeKey = String(secrets.get('STRIPE_SECRET_KEY') || '');
  const stripeHook = !!secrets.get('STRIPE_WEBHOOK_SECRET');
  let stripe = false;
  if (stripeKey.startsWith('sk_live_') && stripeHook) {
    try {
      const client = new Stripe(stripeKey);
      const [account, webhookEndpoints] = await Promise.all([
        client.accounts.retrieve(),
        client.webhookEndpoints.list({ limit: 100 }),
      ]);
      stripe = account?.charges_enabled === true &&
        (webhookEndpoints.data || []).some((e: any) => stripeWebhookMatches(e) && stripeEnabledEvents(e));
    } catch (_) { /* Fail closed. */ }
  }
  // This is configuration presence only: until the provider verifies IFund's
  // pooled donations and settlement agreement, it must never enable transfers.
  const nowpaymentsConfigured = !!(secrets.get('NOWPAYMENTS_API_KEY') && secrets.get('NOWPAYMENTS_IPN_SECRET'));
  const reownConfigured = !!secrets.get('REOWN_PROJECT_ID');
  const openaiConfigured = !!secrets.get('OPENAI_API_KEY');
  return {
    paypal_checkout: settled(paypal, paypal ? 'Verified live PayPal REST account' : 'Live PayPal account verification required'),
    paypal_payouts: settled(payouts, payouts ? 'Verified PayPal payouts' : 'PayPal payouts must be verified separately'),
    stripe_checkout: settled(stripe, stripe ? 'Live Stripe account and signed webhook verified' : 'Stripe live account and matching webhook required'),
    nowpayments: settled(false, nowpaymentsConfigured ? 'Credentials present; merchant approval, IPN and settlement are not verified' : 'NOWPayments merchant account, API key and IPN setup required'),
    reown: settled(false, reownConfigured ? 'Server-side project reference exists; website allowlist and client configuration unverified' : 'Reown Project ID and allowed website origins required'),
    openai: settled(false, openaiConfigured ? 'API key configured; agent execution not independently verified' : 'An authorized AI execution provider and runtime test are required'),
  };
}

export function assessFeatureReadiness(key: string, providers: Awaited<ReturnType<typeof probeLiveProviders>>, registry: any[] = []) {
  const p = providers;
  const pp = p.paypal_checkout.ready;
  const st = p.stripe_checkout.ready;
  const payout = p.paypal_payouts.ready;
  const registryActive = (platform: string) => registry.some((r: any) =>
    String(r.platform || '').toLowerCase() === platform &&
    String(r.status || '').toUpperCase() === 'ACTIVE' && r.provider_verified === true);
  const social = ['facebook_pages','linkedin','discord','instagram','tiktok'].some(registryActive);
  const connectedNetwork = ['facebook_pages','linkedin','discord','instagram','tiktok','wix','github'].some(registryActive);
  const known: Record<string, ReturnType<typeof settled>> = {
    public_campaign_fundraising: settled((pp || st) && payout, 'Requires verified donation processing and a verified payout route'),
    payment_checkout_enabled: settled(pp || st, 'Requires at least one verified payment processor'),
    paypal_checkout: settled(pp, p.paypal_checkout.explanation),
    google_pay_checkout: settled(false, 'Google Pay wallet processing has not been independently verified end to end'),
    stripe_checkout: settled(st, p.stripe_checkout.explanation),
    recurring_donations: settled(st, 'Requires verified Stripe billing events and checkout'),
    subscription_checkout: settled(st, 'Requires verified Stripe subscription billing and settlement; PayPal subscription verification is separate'),
    outbound_payout_execution: settled(payout, p.paypal_payouts.explanation),
    ai_campaign_assistant: settled(false, 'AI provider credentials and campaign-assistant runtime must be tested'),
    ai_outreach_agent: settled(false, 'AI runtime, consent and outbound messaging must be tested'),
    social_autopilot: settled(false, 'Posting permissions, consent and live publication must be verified'),
    cross_platform_publishing: settled(social, 'Requires at least one provider-verified social publishing connection'),
    managed_connections: settled(connectedNetwork, 'Requires provider-verified authorization; unverified tokens are not sufficient'),
    external_campaign_import: settled(false, 'Requires a successful authenticated import and ongoing synchronization'),
    external_fund_collection: settled(false, 'Requires external settlement, custody and reconciliation verification'),
    external_feed_mirroring: settled(false, 'Requires tested feed subscriptions and data provenance'),
    community_creation: settled(true, 'Native IFund capability; administrator can control availability'),
    institution_programs: settled(true, 'Native IFund capability; administrator can control availability'),
    admin_agent_execution: settled(false, 'Admin agent runtime not confirmed end to end'),
    crypto_donations: settled(false, 'Approved cryptocurrency receiving, confirmations and settlement are not connected'),
  };
  return known[key] || settled(false, 'Not mapped to a live backend implementation');
}

export function liveFeatureSnapshot(key: string, flags: any[], providers: Awaited<ReturnType<typeof probeLiveProviders>>, registry: any[] = []) {
  const matching = flags.filter((r: any) => r.key === key);
  const flag = matching.length === 1 && matching[0].scope === FEATURE_SCOPES[key] ? matching[0] : null;
  const ready = assessFeatureReadiness(key, providers, registry);
  return {
    key,
    label: LIVE_FEATURE_NAMES[key] || key,
    scope: FEATURE_SCOPES[key] || null,
    flag_id: flag?.id || null,
    enabled: flag?.enabled === true,
    code_connected: CODE_CONNECTED_FEATURES.includes(key),
    provider_ready: ready.ready,
    detail: ready.explanation,
    state: !CODE_CONNECTED_FEATURES.includes(key) ? 'not_implemented' :
      !flag ? 'switch_missing' : !ready.ready ? 'setup_needed' :
      flag.enabled === true ? 'live_enabled' : 'ready_off',
  };
}
