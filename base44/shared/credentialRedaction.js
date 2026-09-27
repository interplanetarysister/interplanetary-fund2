// Secret credential fields must never leave server-owned connection functions.
// Non-secret identifiers stay visible so owners can recognize and edit a route.
export const SECRET_FIELDS = [
  'kofi_verification_token',
  'bluesky_app_password',
  'mastodon_access_token',
];

export function redactCredentials(creds) {
  const source = creds || {};
  const credentials = { ...source };
  const credentials_meta = {};
  for (const field of SECRET_FIELDS) {
    credentials_meta[`${field}_set`] = !!source[field];
    if (credentials[field]) credentials[field] = '';
  }
  return { credentials, credentials_meta };
}

export function redactPlatformConnection(connection) {
  const { credentials, credentials_meta } = redactCredentials(connection?.credentials);
  return { ...connection, credentials, credentials_meta };
}
