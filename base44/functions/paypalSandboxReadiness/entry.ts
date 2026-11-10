import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import {
  PAYPAL_SECRET_NAMES, isPayPalSandboxDemoEnabled, paypalCredentials, paypalMerchantEmail,
  paypalWebhookId, probePayPalAccessToken,
} from '../../shared/paypalEnvironment.ts';
import { PAYPAL_CAMPAIGN_WEBHOOK_URL } from '../../shared/paypalCampaignWebhookContract.js';
import { isPublicCampaignFundraisingEnabled } from '../../shared/fundraisingMode.ts';

// Admin-only PayPal sandbox readiness. Performs a real OAuth token request and
// inspects the actual runtime: secrets (names only), webhook registration,
// HTTPS endpoint, entities and the demo gate. It NEVER returns a secret, token
// or partial credential, and it never claims readiness without a passing call.
const ENTITIES = [
  'PayPalOrder', 'PayPalCampaignWebhook', 'WebhookEvent',
  'FinancialOperation', 'Donation', 'HoldingLedgerEntry',
];

const present = (name: string) => Boolean(String(secrets.get(name) || '').trim());

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only.' }, { status: 403 });

    const sr = base44.asServiceRole;
    const secretsPresent = Object.fromEntries(PAYPAL_SECRET_NAMES.map((name) => [name, present(name)]));
    const { clientId, clientSecret } = paypalCredentials('sandbox');
    const credentialsConfigured = Boolean(clientId && clientSecret);

    const token = credentialsConfigured
      ? await probePayPalAccessToken('sandbox')
      : { ok: false, status: 0, error: 'credentials_missing' };

    const webhookSecret = paypalWebhookId('sandbox');
    const webhookRows = await sr.entities.PayPalCampaignWebhook
      .filter({ provider: 'paypal', environment: 'sandbox' }).catch(() => null);
    const registered = Array.isArray(webhookRows)
      ? webhookRows.filter((row) => row.url === PAYPAL_CAMPAIGN_WEBHOOK_URL && row.webhook_id)
      : null;
    const webhookIdPresent = Boolean(webhookSecret) || Boolean(registered && registered.length === 1);

    const entities = {};
    for (const name of ENTITIES) {
      try {
        await sr.entities[name].filter({}, '-created_date', 1);
        entities[name] = 'ok';
      } catch (_) {
        entities[name] = 'unavailable';
      }
    }
    const entitiesOk = Object.values(entities).every((value) => value === 'ok');

    const demoEnabled = await isPayPalSandboxDemoEnabled(sr);
    const livePaused = !(await isPublicCampaignFundraisingEnabled(base44));
    const endpointHttps = /^https:\/\//.test(PAYPAL_CAMPAIGN_WEBHOOK_URL);
    const merchantEmail = paypalMerchantEmail('sandbox');

    const missing = [];
    if (!credentialsConfigured) missing.push('PAYPAL_SANDBOX_CLIENT_ID and PAYPAL_SANDBOX_CLIENT_SECRET');
    if (credentialsConfigured && !token.ok) missing.push(`Working sandbox credentials (probe: ${token.error})`);
    if (!webhookIdPresent) missing.push('PAYPAL_SANDBOX_WEBHOOK_ID (register the webhook in the PayPal developer dashboard for this sandbox app)');
    if (!endpointHttps) missing.push('HTTPS webhook endpoint');
    if (!entitiesOk) missing.push('Entity access (see entities below)');
    if (!demoEnabled) missing.push('Sandbox demo feature flag "paypal_sandbox_demo" (global, disabled or missing)');
    if (!merchantEmail) missing.push('PAYPAL_SANDBOX_MERCHANT_EMAIL (optional; without it the sandbox REST app owner receives test funds)');

    const blockingMissing = missing.filter((item) => !item.startsWith('PAYPAL_SANDBOX_MERCHANT_EMAIL'));

    return Response.json({
      ok: blockingMissing.length === 0,
      environment: 'sandbox',
      checked_at: new Date().toISOString(),
      secrets: secretsPresent,
      credentials_configured: credentialsConfigured,
      token_probe: { ok: token.ok, status: token.status, error: token.error || '' },
      webhook: {
        id_present: webhookIdPresent,
        source: webhookSecret ? 'secret' : registered?.length === 1 ? 'registered_entity' : 'missing',
        endpoint: PAYPAL_CAMPAIGN_WEBHOOK_URL,
        endpoint_https: endpointHttps,
        events: ['PAYMENT.CAPTURE.COMPLETED', 'PAYMENT.CAPTURE.PENDING', 'PAYMENT.CAPTURE.DENIED', 'PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.CAPTURE.REVERSED', 'CHECKOUT.ORDER.APPROVED'],
      },
      merchant: { email: merchantEmail || '', configured: Boolean(merchantEmail), sandbox_app_owner_fallback: !merchantEmail },
      entities,
      demo_flag_enabled: demoEnabled,
      live_campaign_fundraising_paused: livePaused,
      paypal_mode: String(secrets.get('PAYPAL_MODE') || 'unset'),
      missing,
      next_steps: [
        'Create (or reuse) a PayPal REST app in the SANDBOX environment: developer.paypal.com > Apps & Credentials > Sandbox.',
        'Add secrets PAYPAL_SANDBOX_CLIENT_ID, PAYPAL_SANDBOX_CLIENT_SECRET (server-only) and PAYPAL_SANDBOX_MERCHANT_EMAIL (the sandbox business account that should receive test funds).',
        `Register webhook ${PAYPAL_CAMPAIGN_WEBHOOK_URL} in that sandbox app for the capture events, then add secret PAYPAL_SANDBOX_WEBHOOK_ID.`,
        'Enable the global feature flag "paypal_sandbox_demo" (Platform > Feature flags). Leave public_campaign_fundraising and payment_checkout_enabled OFF.',
        'Re-run this check until ok=true, then test with a sandbox PERSONAL buyer account. No real money moves.',
      ],
    });
  } catch (error) {
    console.error('paypalSandboxReadiness:', error?.name || 'UnknownError');
    return Response.json({ error: 'Readiness check did not complete.' }, { status: 503 });
  }
}