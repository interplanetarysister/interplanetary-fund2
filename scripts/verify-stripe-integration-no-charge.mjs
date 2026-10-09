import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { subscriptionPrices, stripePriceFor } from '../base44/shared/subscriptionCatalog.js';
const read = p => readFileSync(p, 'utf8');
const audit = read('base44/functions/getStripeIntegrationAudit/entry.ts');
const repair = read('base44/functions/repairStripeWebhookEvents/entry.ts');
const webhook = read('base44/functions/stripeWebhook/entry.ts');
const crypto = read('base44/shared/stripeCryptoReadiness.ts');
const platform = read('src/pages/Platform.jsx');
const ui = read('src/components/platform/StripeIntegrationPanel.jsx');
const agent = JSON.parse(read('base44/agents/outreach_agent.jsonc'));
const schema = JSON.parse(read('base44/entities/StripeReversalHold.jsonc'));
for (const [name, code] of [['audit',audit],['repair',repair]]) {
  assert.match(code, /user\.role !== 'admin'/, `${name} must be admin-only`);
  assert.match(code, /req\.method !== 'POST'/);
}
for (const kind of ['stripe.accounts.retrieve','stripe.webhookEndpoints.list','stripe.products.list','stripe.paymentMethodConfigurations.list','resolveStripeSubscriptionPrice'])
  assert.ok(audit.includes(kind), `Missing Stripe account audit operation ${kind}`);
for (const forbidden of [/stripe\.checkout\.sessions\.create/,/stripe\.prices\.create/,/stripe\.products\.create/,/stripe\.transfers\.create/,/stripe\.payouts\.create/,/stripe\.charges\.create/,/stripe\.accounts\.update/,/stripe\.refunds\.create/,/stripe\.apiKeys\.create/])
  assert.doesNotMatch(audit+repair, forbidden, 'Stripe maintenance must not initiate money movement or paid resources');
assert.match(repair, /matching\.length !== 1/, 'Must never pick between multiple matching Stripe webhooks');
assert.match(repair, /stripe\.webhookEndpoints\.update\(endpoint\.id/, 'Only edit existing webhook');
assert.doesNotMatch(repair, /stripe\.webhookEndpoints\.create/, 'Do not create new endpoint lacking securely stored secret');
for(const e of ['charge.refunded','charge.dispute.created','checkout.session.async_payment_succeeded']) {
  assert.ok(audit.includes(e) && repair.includes(e), 'Missing safety webhook coverage: ' + e);
}
assert.match(webhook,/StripeReversalHold\.create/);
assert.match(webhook,/payment_verified: false/);
assert.match(webhook,/STRIPE_REVERSAL_HOLD/);
assert.match(webhook,/reconcileCanonicalCampaignProjection/);
assert.match(crypto,/charge\.refunded/);
assert.match(platform, /StripeIntegrationPanel/);
assert.match(ui, /getStripeIntegrationAudit/);
assert.match(ui, /repairStripeWebhookEvents/);
assert.ok((agent.tool_configs||[]).some(item=>item.function_name==='getStripeIntegrationAudit'));
assert.ok((agent.tool_configs||[]).some(item=>item.function_name==='repairStripeWebhookEvents'));
assert.equal(schema.rls.create.user_condition.role,'admin');
// Never advertise restricted Stripe accounts as purchasable merely because catalog prices exist.
const options = read('base44/functions/getStripeSubscriptionOptions/entry.ts');
const checkout = read('base44/functions/createSubscriptionCheckout/entry.ts');
const pass = read('base44/functions/createPremiumDayPassCheckout/entry.ts');
for (const code of [options, checkout, pass]) {
  assert.match(code, /stripe\.accounts\.retrieve\(\)/, 'Live merchant capabilities must be checked');
  assert.match(code, /charges_enabled/, 'The account must be allowed to charge customers');
  assert.match(code, /card_payments/, 'Card payment capability must be active');
}
assert.match(options, /available = !!found && paymentReady && endpointReady/);
assert.match(options, /dayPassAvailable = accessAvailable && paymentReady && endpointReady/);
const linkedPrices = subscriptionPrices().map(p => stripePriceFor(p.tier, p.interval));
assert.equal(linkedPrices.length, 10, 'Five tiers require monthly and annual prices');
assert.equal(new Set(linkedPrices).size, 10, 'Every billing option must have its own price');
assert.ok(linkedPrices.every(id => /^price_[a-zA-Z0-9]+$/.test(id)), 'Missing live Stripe price mapping');
console.log('PASS: ten subscription Stripe price IDs, admin-only audit, refund/dispute holds and live merchant checkout capability gates.');
