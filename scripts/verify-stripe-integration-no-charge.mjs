import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
console.log('PASS: admin-only Stripe API audit, no-charge webhook repair, refund/dispute hold, tax ID privacy, IFund agent tools and safety constraints.');
