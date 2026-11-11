import { secrets } from 'base44:runtime';
import { paypalWebhookAdminRequest, IFUND_PAYPAL_ACCOUNT_REF } from './paypal.ts';
import { paypalWebhookId, resolvePayPalEnvironment, type PayPalEnvironment } from './paypalEnvironment.ts';
import { PAYPAL_CAMPAIGN_WEBHOOK_URL, PAYPAL_CAMPAIGN_WEBHOOK_EVENTS } from './paypalCampaignWebhookContract.js';

// A PayPal webhook ID belongs to ONE subscribed callback. A billing webhook,
// another iFund deployment, or a stale secret is never sufficient for campaign
// donation readiness. Resolve the ID against PayPal's own live/sandbox REST app.
// Read-only: never creates a listener, captures money, or writes financial data.
const cache: Record<string, { until: number; id: string; pending: Promise<string> | null }> = {};

const validId = (id: unknown): id is string =>
  typeof id === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(id);

const matchesCampaignCallback = (hook: any): boolean => {
  if (!validId(hook?.id) || hook?.url !== PAYPAL_CAMPAIGN_WEBHOOK_URL) return false;
  const events = new Set(
    (Array.isArray(hook?.event_types) ? hook.event_types : [])
      .map((event: any) => String(event?.name || ''))
  );
  return events.has('*') || PAYPAL_CAMPAIGN_WEBHOOK_EVENTS.every(name => events.has(name));
};

export async function resolveVerifiedCampaignWebhookId(
  sr: any,
  environment: PayPalEnvironment = resolvePayPalEnvironment(),
): Promise<string> {
  if (environment !== resolvePayPalEnvironment()) return '';
  if (String(secrets.get('PAYPAL_MODE') || '') !== environment) return '';

  const cached = cache[environment];
  if (cached?.until > Date.now()) return cached.id;
  if (cached?.pending) return await cached.pending;

  const pending = (async (): Promise<string> => {
    const candidates: string[] = [];
    const configured = String(paypalWebhookId(environment) || '').trim();
    if (validId(configured)) candidates.push(configured);

    const rows = await sr.entities.PayPalCampaignWebhook.filter({
      provider: 'paypal',
      account_ref: IFUND_PAYPAL_ACCOUNT_REF,
      environment,
    }).catch(() => null);
    if (!Array.isArray(rows)) return '';

    const local = rows.filter((row: any) =>
      row.url === PAYPAL_CAMPAIGN_WEBHOOK_URL && validId(row.webhook_id));
    if (local.length > 1 || rows.some((row: any) => row.url !== PAYPAL_CAMPAIGN_WEBHOOK_URL))
      return '';
    for (const row of local) {
      if (!candidates.includes(String(row.webhook_id))) candidates.push(String(row.webhook_id));
    }

    for (const id of candidates) {
      try {
        const remote = await paypalWebhookAdminRequest(
          '/v1/notifications/webhooks/' + encodeURIComponent(id)
        );
        if (remote?.id === id && matchesCampaignCallback(remote)) return id;
      } catch { /* A stale ID is not authority. Discover the canonical callback. */ }
    }
    // The REST application can have other legitimate billing and site webhooks.
    // Find the one registered for THIS callback without relying on a possibly
    // stale PAYPAL_WEBHOOK_ID secret or creating a duplicate.
    const inventory = await paypalWebhookAdminRequest('/v1/notifications/webhooks');
    const sameUrl = (Array.isArray(inventory?.webhooks) ? inventory.webhooks : [])
      .filter((hook: any) => hook.url === PAYPAL_CAMPAIGN_WEBHOOK_URL);
    if (sameUrl.length !== 1 || !validId(sameUrl[0]?.id)) return '';
    const remote = await paypalWebhookAdminRequest(
      '/v1/notifications/webhooks/' + encodeURIComponent(sameUrl[0].id)
    );
    return matchesCampaignCallback(remote) && remote.id === sameUrl[0].id
      ? String(remote.id) : '';
  })().catch(() => '');

  cache[environment] = { until: 0, id: '', pending };
  const id = await pending;
  cache[environment] = { until: Date.now() + (id ? 60000 : 15000), id, pending: null };
  return id;
}
