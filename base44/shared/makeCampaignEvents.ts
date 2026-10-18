// Opt-in outbound campaign event delivery. Never include donor or financial records.
// Configure IFUND_MAKE_WEBHOOK_URL and IFUND_MAKE_WEBHOOK_SECRET only in server secrets.
// The receiver must verify X-IFund-Signature and X-IFund-Timestamp before processing.
const enc = new TextEncoder();
const hex = (bytes) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
export async function notifyMakeCampaignEvent(campaign, action) {
  if (campaign?.status !== 'active' || campaign?.outreach_enabled !== true ||
      campaign?.outreach_paused === true) return { skipped: 'consent_or_visibility' };
  const url = Deno.env.get('IFUND_MAKE_WEBHOOK_URL') || '';
  const secret = Deno.env.get('IFUND_MAKE_WEBHOOK_SECRET') || '';
  if (!url || secret.length < 32) return { skipped: 'not_configured' };
  const target = new URL(url);
  if (target.protocol !== 'https:' || !/^(hook\.)?us2\.make\.com$/.test(target.hostname))
    return { skipped: 'invalid_destination' };
  const body = JSON.stringify({
    schema_version: 1, event: action, event_id: crypto.randomUUID(),
    campaign_id: String(campaign.id), occurred_at: new Date().toISOString(),
    campaign: {
      id: String(campaign.id), title: String(campaign.title || '').slice(0, 200),
      summary: String(campaign.summary || '').slice(0, 1000),
      url: 'https://interplanetaryfund.com/campaign/' + encodeURIComponent(campaign.id)
    },
    automation_consent: true
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(timestamp + '.' + body))));
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-ifund-timestamp': timestamp, 'x-ifund-signature': 'sha256=' + signature },
    body, signal: AbortSignal.timeout(4500)
  });
  if (!response.ok) throw new Error('Campaign event destination rejected request: ' + response.status);
  return { delivered: true };
}
