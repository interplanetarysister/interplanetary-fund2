import { secrets } from "base44:runtime";

// PayPal sandbox/live environment resolution.
//
// Sandbox and live use different PayPal REST applications and different
// webhooks, so their credentials are never interchangeable. Sandbox demo
// secrets are read first and take precedence; the live application's keys are
// only used for a deliberately sandboxed deployment (PAYPAL_MODE=sandbox).

export type PayPalEnvironment = 'sandbox' | 'live';

export const IFUND_PAYPAL_BUSINESS_EMAIL = 'cuddlemeplatonically@gmail.com';
export const PAYPAL_SANDBOX_DEMO_FLAG = 'paypal_sandbox_demo';

const text = (name: string) => String(secrets.get(name) || '').trim();

export function resolvePayPalEnvironment(): PayPalEnvironment {
  // Explicit operational switch: storing sandbox credentials alone never
  // changes live payment routing, payouts or webhook verification.
  return text('PAYPAL_MODE') === 'sandbox' ? 'sandbox' : 'live';
}

export function paypalCredentials(environment: PayPalEnvironment = resolvePayPalEnvironment()) {
  if (environment === 'sandbox') {
    const dedicatedId = text('PAYPAL_SANDBOX_CLIENT_ID');
    const dedicatedSecret = text('PAYPAL_SANDBOX_CLIENT_SECRET');
    if (dedicatedId && dedicatedSecret) return { clientId: dedicatedId, clientSecret: dedicatedSecret };
    // Fail closed rather than accidentally sending live credentials to the
    // sandbox OAuth endpoint when the deployment is switched.
    return { clientId: '', clientSecret: '' };
  }
  return { clientId: text('PAYPAL_CLIENT_ID'), clientSecret: text('PAYPAL_CLIENT_SECRET') };
}

export function paypalApiBase(environment: PayPalEnvironment = resolvePayPalEnvironment()) {
  return environment === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

export function paypalWebhookId(environment: PayPalEnvironment = resolvePayPalEnvironment()) {
  return environment === 'sandbox' ? text('PAYPAL_SANDBOX_WEBHOOK_ID') : text('PAYPAL_WEBHOOK_ID');
}

export function paypalMerchantEmail(environment: PayPalEnvironment = resolvePayPalEnvironment()) {
  return environment === 'sandbox' ? text('PAYPAL_SANDBOX_MERCHANT_EMAIL') : IFUND_PAYPAL_BUSINESS_EMAIL;
}

export function paypalSandboxCredentialsPresent() {
  const { clientId, clientSecret } = paypalCredentials('sandbox');
  return Boolean(clientId && clientSecret);
}

// Sandbox demo checkout is a separate, administrator-gated path so the paused
// live-payment policy never blocks fake-money testing. A missing, duplicated or
// mis-scoped flag keeps it closed.
export async function isPayPalSandboxDemoEnabled(sr: any): Promise<boolean> {
  try {
    const rows = await sr.entities.FeatureFlag.filter({ key: PAYPAL_SANDBOX_DEMO_FLAG });
    return Array.isArray(rows) && rows.length === 1 &&
      rows[0]?.scope === 'global' && rows[0]?.enabled === true;
  } catch (_) {
    return false;
  }
}

// Real, read-only OAuth probe. A populated client id alone never proves the
// sandbox application works. Returns no token — only a boolean and a sanitized
// reason a human can act on.
export async function probePayPalAccessToken(environment: PayPalEnvironment = resolvePayPalEnvironment()) {
  const { clientId, clientSecret } = paypalCredentials(environment);
  if (!clientId || !clientSecret) {
    return { ok: false, status: 0, error: 'credentials_missing' };
  }
  let response;
  try {
    response = await fetch(`${paypalApiBase(environment)}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${clientId}:${clientSecret}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
  } catch (cause) {
    return { ok: false, status: 0, error: 'network_unreachable' };
  }
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: response.status === 401 || response.status === 403 ? 'credentials_rejected' : 'token_request_failed',
    };
  }
  const data = await response.json().catch(() => ({}));
  return { ok: Boolean(data?.access_token), status: response.status, error: data?.access_token ? '' : 'token_missing' };
}

// Names only. Never returns a secret value.
export const PAYPAL_SECRET_NAMES = Object.freeze([
  'PAYPAL_SANDBOX_CLIENT_ID',
  'PAYPAL_SANDBOX_CLIENT_SECRET',
  'PAYPAL_SANDBOX_WEBHOOK_ID',
  'PAYPAL_SANDBOX_MERCHANT_EMAIL',
  'PAYPAL_MODE',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_ID',
]);