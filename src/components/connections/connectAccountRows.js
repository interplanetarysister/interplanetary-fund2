// One row per destination on the Connect accounts page. The order is fixed so a
// reviewer can check every platform in a single pass.
export const CONNECT_ACCOUNT_ORDER = [
  'gofundme',
  'givebutter',
  'donorbox',
  'fundly',
  'kickstarter',
  'indiegogo',
  'facebook_pages',
  'instagram',
  'linkedin',
  'x',
  'tiktok',
  'youtube',
];

const PUBLIC_LINK_NOTE =
  'This platform has no public API, so IFund can link the campaign but cannot read your account.';

// Platforms with no usable connection method. Their button is always disabled
// and the gate is visible; nothing here is a dead click.
export const SOCIAL_GATES = {
  facebook_pages: 'Meta App Review and business verification required',
  instagram: 'Meta App Review and business verification required',
  linkedin: 'LinkedIn org permissions need approval',
  x: 'X developer app review required',
  tiktok: 'TikTok app audit required',
  youtube: 'Google verification required for upload scope',
};

export const ACCOUNT_ROW_COPY = {
  givebutter: {
    label: 'Connect with key',
    helper: 'Key at Settings > Integrations > API Keys.',
  },
  donorbox: {
    label: 'Connect with key',
    helper:
      'Key at Account > API & Zapier Integration. Donorbox requires a paid plan that includes API access.',
  },
  fundly: { label: 'Add public link', helper: PUBLIC_LINK_NOTE },
  kickstarter: { label: 'Add public link', helper: PUBLIC_LINK_NOTE },
  indiegogo: { label: 'Add public link', helper: PUBLIC_LINK_NOTE },
  gofundme: {
    label: 'Add public link',
    helper: PUBLIC_LINK_NOTE,
    secondary: {
      label: 'Connect GoFundMe Pro (OAuth 2.0)',
      helper: "Requires a GoFundMe Pro account and IFund's GoFundMe Pro client credentials.",
      confirm: 'I have a GoFundMe Pro account',
    },
  },
};

// The badge reports what the backend actually found for this platform, not what
// the provider might support one day.
export function methodBadge(platform, method, meta) {
  const found = String(method || '');
  if (found === 'api_key') return 'API key';
  if (found === 'oauth') return 'OAuth 2.0';
  if (meta?.kind === 'social') return 'No method yet';
  return 'Public link only';
}

export function statusChip(connection) {
  if (!connection) return { text: 'Not connected', className: 'border-border bg-muted text-muted-foreground' };
  if (connection.status === 'connected' && connection.verification_status === 'verified')
    return { text: 'Connected', className: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' };
  if (connection.status === 'error')
    return { text: 'Error', className: 'border-red-300 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200' };
  if (connection.status === 'connected')
    return { text: 'Needs attention', className: 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200' };
  return { text: 'Needs setup', className: 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200' };
}