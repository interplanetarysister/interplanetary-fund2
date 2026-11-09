// Owner-scoped provider credential vault. Provider secrets live ONLY here as
// AES-GCM ciphertext; a PlatformConnection keeps just a vault reference and a
// masked hint. No plaintext secret is ever logged, returned, or written back to
// PlatformConnection. If the encryption key is not provisioned, every write
// fails closed instead of falling back to plaintext.
import { encryptConnectionSecret, decryptConnectionSecret } from './connectionCrypto.ts';

// Fields the vault owns per platform. Legacy PlatformConnection plaintext for
// these is migrated and blanked.
export const VAULT_FIELDS: Record<string, string[]> = {
  kofi: ['kofi_verification_token'],
  buymeacoffee: ['buymeacoffee_api_token'],
  bluesky: ['bluesky_handle', 'bluesky_app_password'],
  mastodon: ['mastodon_instance', 'mastodon_access_token'],
  givebutter: ['givebutter_api_key'],
  donorbox: ['donorbox_api_key', 'donorbox_email'],
};

export function maskedHint(value: string): string {
  const text = String(value || '');
  if (!text) return '';
  return text.length <= 4 ? '••••' : '•••• ' + text.slice(-4);
}

async function readBundle(sr: any, userId: string, platform: string) {
  const rows = await sr.entities.UserCredentialVault
    .filter({ user_id: userId, platform })
    .catch(() => []);
  if (!Array.isArray(rows) || rows.length === 0) return { row: null, bundle: {} };
  if (rows.length > 1) throw new Error('vault_duplicate');
  const row = rows[0];
  if (!row?.ciphertext) return { row, bundle: {} };
  try {
    const parsed = JSON.parse(await decryptConnectionSecret(row.ciphertext));
    return { row, bundle: parsed && typeof parsed === 'object' ? parsed : {} };
  } catch {
    // An unreadable bundle never becomes a plaintext fallback.
    return { row, bundle: {} };
  }
}

// Store/merge secret fields for one member + platform. Returns the vault row id
// used as the connection's vault reference.
export async function writeVaultSecrets(sr: any, userId: string, platform: string, fields: Record<string, string>) {
  const allowed = new Set(VAULT_FIELDS[platform] || []);
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (!allowed.has(key)) continue;
    const text = String(value ?? '').trim();
    if (text) clean[key] = text;
  }
  if (!Object.keys(clean).length) return '';
  const { row, bundle } = await readBundle(sr, userId, platform);
  const next = { ...bundle, ...clean };
  const ciphertext = await encryptConnectionSecret(JSON.stringify(next));
  const now = new Date().toISOString();
  if (row) {
    await sr.entities.UserCredentialVault.update(row.id, { ciphertext, updated_at: now });
    return row.id;
  }
  const created = await sr.entities.UserCredentialVault.create({
    user_id: userId,
    platform,
    ciphertext,
    version: 1,
    created_at: now,
    updated_at: now,
  });
  return created.id;
}

// Server-side read for a verification probe. Never returned to a client.
export async function readVaultSecrets(sr: any, userId: string, platform: string) {
  try {
    const { bundle } = await readBundle(sr, userId, platform);
    return bundle || {};
  } catch {
    return {};
  }
}

// Merge vault-held values into a connection's credentials for provider probes
// that still read from the record. Never mutates the stored row.
export async function withVaultCredentials(sr: any, connection: any) {
  if (!connection?.platform || !connection?.created_by_id) return connection;
  const fields = VAULT_FIELDS[connection.platform] || [];
  if (!fields.length) return connection;
  const stored = await readVaultSecrets(sr, connection.created_by_id, connection.platform);
  const merged = { ...(connection.credentials || {}) };
  for (const field of fields) {
    if (!merged[field] && stored[field]) merged[field] = stored[field];
  }
  return { ...connection, credentials: merged };
}