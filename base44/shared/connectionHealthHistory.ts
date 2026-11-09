// Connection history keeps at most one failure receipt per connection per day.
// Repeated scheduled probes must not append a new failure row every hour, which
// produced weeks of identical entries on the Connections page.
const DAY_MS = 24 * 60 * 60 * 1000;

export function appendHealthEvent(history: any, event: string, detail: string, at: string, limit = 30) {
  const list = Array.isArray(history) ? history : [];
  if (event === 'health_check_failed') {
    const cutoff = Date.parse(at) - DAY_MS;
    const recent = list.some((item) => item?.event === 'health_check_failed' &&
      Number.isFinite(Date.parse(item?.at)) && Date.parse(item.at) >= cutoff);
    if (recent) return list;
  }
  return [...list, { at, event, detail }].slice(-limit);
}

// A platform with no configured adapter, no registered OAuth client, or no
// provider webhook is a setup task — not a failing connection.
export const SETUP_REASONS = new Set([
  'provider_probe_unavailable',
  'oauth_not_configured',
  'kofi_webhook_required',
]);

export function isSetupReason(reason: string) {
  const text = String(reason || '');
  if (SETUP_REASONS.has(text)) return true;
  // A missing or unparseable external link, or a platform with no public probe,
  // is configuration the member can still finish — not a failed connection.
  if (text === 'Invalid URL') return true;
  return text.startsWith('Public-page verification is not available');
}