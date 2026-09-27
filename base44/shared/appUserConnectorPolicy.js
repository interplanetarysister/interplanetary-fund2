const APP_READ = ['read_account', 'read_resources'];
const MESSAGING = ['read_account', 'read_messages', 'reply_message'];
const SOCIAL = [
  'read_account', 'read_resources',
  'create_post', 'edit_post', 'delete_own_post', 'upload_media',
  'read_interactions', 'comment', 'reply_comment',
  'read_messages', 'reply_message', 'read_analytics',
];
const CROWDFUNDING_READ = [
  'read_account', 'read_resources', 'read_campaign', 'read_analytics',
  'read_donations', 'read_payments', 'read_transactions',
  'subscribe_events', 'reconcile_external_funds', 'settlement_status',
];

const POLICIES = {
  gmail: MESSAGING,
  googledrive: APP_READ,
  googlecalendar: APP_READ,
  google_contacts: APP_READ,
  google_photos: APP_READ,
  googlesheets: APP_READ,
  googledocs: APP_READ,
  googleforms: APP_READ,
  googletasks: APP_READ,
  slack: MESSAGING,
  notion: APP_READ,
  outlook: MESSAGING,
  microsoft_teams: MESSAGING,
  one_drive: APP_READ,
  dropbox: APP_READ,
  github: APP_READ,
  gitlab: APP_READ,
  linkedin: SOCIAL,
  facebook: SOCIAL,
  instagram: SOCIAL,
  discord: SOCIAL,
  tiktok: SOCIAL,
  threads: SOCIAL,
  x: SOCIAL,
  pinterest: SOCIAL,
  reddit: SOCIAL,
  youtube: SOCIAL,
  patreon: CROWDFUNDING_READ,
};

export function connectorPolicy(platform) {
  return { requestedCapabilities: [...(POLICIES[String(platform || '').toLowerCase()] || [])] };
}

export function providerCapabilities(oauth) {
  const raw = oauth?.capabilities || oauth?.grantedCapabilities || oauth?.scopes || oauth?.scope;
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[ ,]+/)
      : [];
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}
