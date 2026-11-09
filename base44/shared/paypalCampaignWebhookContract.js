// Shared PayPal campaign webhook contract. No charges, captures or money writes.
// The subscription webhook is a separate REST application callback.
export const PAYPAL_CAMPAIGN_WEBHOOK_URL =
  'https://interplanetaryfund.base44.app/functions/payPalCampaignWebhook';
export const PAYPAL_CAMPAIGN_WEBHOOK_EVENTS = Object.freeze([
  'CHECKOUT.ORDER.APPROVED',
  'CHECKOUT.PAYMENT-APPROVAL.REVERSED',
  'PAYMENT.CAPTURE.PENDING',
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.DENIED',
  'PAYMENT.CAPTURE.REFUNDED',
  'PAYMENT.CAPTURE.REVERSED',
]);
export const PAYPAL_CAMPAIGN_WEBHOOK_EVENT_SET = new Set(PAYPAL_CAMPAIGN_WEBHOOK_EVENTS);
export function paypalCampaignEventInfo(event) {
  const type = String(event?.event_type || '');
  const eventId = String(event?.id || '');
  if (!/^WH-[A-Za-z0-9-]{8,90}$/.test(eventId)) return { ok: false, reason: 'invalid_event_id' };
  if (!PAYPAL_CAMPAIGN_WEBHOOK_EVENT_SET.has(type)) return { ok: true, relevant: false, type, eventId };
  const resource = event?.resource || {};
  const orderId = String(resource?.supplementary_data?.related_ids?.order_id ||
    (type.startsWith('CHECKOUT.') ? resource?.id : '') || '').trim();
  const captureId = type.startsWith('PAYMENT.CAPTURE.') ? String(resource?.id || '').trim() : '';
  if (orderId && !/^[A-Za-z0-9_-]{8,90}$/.test(orderId))
    return { ok: false, reason: 'invalid_order_id' };
  if (captureId && !/^[A-Za-z0-9_-]{8,90}$/.test(captureId))
    return { ok: false, reason: 'invalid_capture_id' };
  return { ok: true, relevant: true, type, eventId, orderId, captureId };
}
export function confirmedCampaignCapture(order, event) {
  const info = paypalCampaignEventInfo(event);
  if (!info.ok || info.type !== 'PAYMENT.CAPTURE.COMPLETED' || !info.orderId || !info.captureId)
    return false;
  const amount = event?.resource?.amount || {};
  const cents = Math.round(Number(amount.value) * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0 || String(amount.currency_code || '').toUpperCase() !== 'USD')
    return false;
  if (String(event?.resource?.status || '').toUpperCase() !== 'COMPLETED') return false;
  // Check the provider's authoritative order rather than trusting the signed
  // event alone. The order's server-generated custom_id binds the campaign.
  const parts = String(order?.custom_id || '').split('|');
  if (!((parts.length === 6 && parts[5] === 'gift_first_v2') || parts.length === 5)) return false;
  if (!parts[0] || !['paypal','googlepay','applepay'].includes(parts[4])) return false;
  const allocations = parts.slice(1,4).map(x => Number(x));
  if (allocations.some(x => !Number.isSafeInteger(x) || x < 0) || allocations[0] <= 0 ||
      allocations[2] > allocations[0]) return false;
  return order?.status === 'COMPLETED' &&
    order?.capture_status === 'COMPLETED' &&
    String(order.capture_id) === info.captureId &&
    String(order.currency || '').toUpperCase() === 'USD' &&
    Math.abs(Math.round(Number(order.amount) * 100) - cents) <= 1 &&
    Math.abs(Math.round(Number(order.amount) * 100) - allocations[0] - allocations[1]) <= 1;
}
