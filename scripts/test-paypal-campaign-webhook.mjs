// Offline, no credentials and no money. Exercises the common PayPal
// webhook contract and guards the production fail-closed code paths.
import assert from 'node:assert/strict';
import { transformSync } from 'esbuild';
import { readFileSync } from 'node:fs';
import {
  PAYPAL_CAMPAIGN_WEBHOOK_EVENTS, PAYPAL_CAMPAIGN_WEBHOOK_URL,
  paypalCampaignEventInfo, confirmedCampaignCapture,
} from '../base44/shared/paypalCampaignWebhookContract.js';

const source = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const receiver = source('base44/functions/payPalCampaignWebhook/entry.ts');
const setup = source('base44/functions/setupPayPalCampaignWebhook/entry.ts');
const admin = source('src/pages/IntegrationsAdmin.jsx');
const readiness = source('base44/functions/validateIntegrationHealth/entry.ts');
const shared = source('base44/shared/paypal.ts');
// The Base44 site build normally transpiles only frontend modules. Independently
// compile each edited backend TypeScript file so preview detects syntax errors
// before production deploys attempt the server function bundles.
for (const script of [shared,receiver,setup,readiness]) transformSync(script, { loader:'ts',format:'esm' });
const schema = JSON.parse(source('base44/entities/PayPalCampaignWebhook.jsonc'));
const types = ['PAYMENT.CAPTURE.COMPLETED','PAYMENT.CAPTURE.PENDING','PAYMENT.CAPTURE.DENIED',
  'PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED','CHECKOUT.ORDER.APPROVED',
  'CHECKOUT.PAYMENT-APPROVAL.REVERSED'];
for (const event of types) assert.ok(PAYPAL_CAMPAIGN_WEBHOOK_EVENTS.includes(event), event);
assert.ok(PAYPAL_CAMPAIGN_WEBHOOK_URL.startsWith('https://interplanetaryfund.base44.app/functions/'));
assert.equal(new Set(PAYPAL_CAMPAIGN_WEBHOOK_EVENTS).size, PAYPAL_CAMPAIGN_WEBHOOK_EVENTS.length);
const event = {
  id: 'WH-TEST-0123456789', event_type: 'PAYMENT.CAPTURE.COMPLETED',
  resource: {
    id: 'CAP-1234567890', status: 'COMPLETED',
    amount: { value: '10.49', currency_code: 'USD' },
    supplementary_data: { related_ids: { order_id: 'ORD-1234567890' } },
  },
};
const order = { status: 'COMPLETED', capture_status: 'COMPLETED',
  capture_id: 'CAP-1234567890', currency: 'USD', amount: 10.49,
  custom_id: 'campaign-1|1000|49|0|paypal|gift_first_v2',
};
assert.deepEqual(paypalCampaignEventInfo(event), {
  ok: true, relevant: true, type: 'PAYMENT.CAPTURE.COMPLETED',
  eventId: 'WH-TEST-0123456789', orderId: 'ORD-1234567890', captureId: 'CAP-1234567890',
});
assert.equal(confirmedCampaignCapture(order,event),true);
assert.equal(confirmedCampaignCapture({...order,capture_id:'CAP-OTHER'},event),false);
assert.equal(confirmedCampaignCapture({...order,amount:999},event),false);
assert.equal(confirmedCampaignCapture({...order,custom_id:'other|1000|49|0|bogus|gift_first_v2'},event),false);
assert.equal(confirmedCampaignCapture({...order,status:'APPROVED'},event),false);
assert.equal(confirmedCampaignCapture({...order,currency:'EUR'},event),false);
assert.equal(confirmedCampaignCapture(order,{...event,resource:{...event.resource,status:'PENDING'}}),false);
assert.equal(confirmedCampaignCapture(order,{...event,resource:{...event.resource,amount:{value:'10.49',currency_code:'EUR'}}}),false);
assert.equal(paypalCampaignEventInfo({...event,id:'bad'}).ok,false);
assert.equal(paypalCampaignEventInfo({...event,event_type:'UNKNOWN'}).relevant,false);
assert.equal(paypalCampaignEventInfo({...event,resource:{...event.resource,id:'!' }}).ok,false);
assert.match(receiver,/verifyWebhookSignature\(raw, req\.headers, hooks\[0\]\.webhook_id\)/);
assert.match(receiver,/confirmedCampaignCapture\(order, event\)/);
assert.match(receiver,/getOrder\(info\.orderId\)/);
assert.match(receiver,/sr\.entities\.FinancialOperation\.filter/);
assert.match(receiver,/canonical_reconciled: false, pending_review: true/);
assert.match(receiver,/status: 202/);
assert.match(receiver,/state: 'claimed'/);
assert.doesNotMatch(receiver,/recordCanonicalDonation\(|sendPayout\(|captureOrder\(|createOrder\(|refundCapture\(/);
assert.match(setup,/assertActiveAccount\(base44\)/);
assert.match(setup,/guard\.user\.role !== 'admin'/);
assert.match(setup,/paypalWebhookAdminRequest\('\/v1\/notifications\/webhooks'/);
assert.match(setup,/sameUrl\.length > 1/);
assert.match(setup,/verify_registered_webhook/);
assert.match(shared,/paypalWebhookAdminRequest/);
assert.match(readiness,/sr\.entities\.PayPalCampaignWebhook\.filter/);
assert.match(admin,/registerPayPalCampaignWebhook/);
assert.match(admin,/setupPayPalCampaignWebhook/);
assert.match(setup,/inspect_only: true/);
assert.match(setup,/registered.length > 0 && sameUrl.length === 0/);
assert.match(setup,/registration_performed: false/);
assert.match(setup,/Array\.isArray\(all\?\.webhooks\)/);
assert.match(admin,/inspectExistingPayPalWebhooks/);
assert.match(admin,/webhook_inventory\.map/);
assert.match(admin,/matching_count/);
for (const action of ['read','create','update','delete'])
  assert.equal(schema.rls[action]?.user_condition?.role,'admin');
console.log('PayPal campaign webhook: contract, provider checks, no financial writes, signature and admin boundaries passed.');
