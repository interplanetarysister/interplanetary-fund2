// Credential-vault key resolution. The vault must work on first use without an
// operator provisioning anything, and it must never fall back to plaintext.
//
// Order:
//  1. An operator-provisioned secret, under the current name or any name a
//     previous version read, so an existing key is never orphaned by a
//     generated one.
//  2. The admin-only VaultMasterKey record. Platform secrets cannot be written
//     from backend code, so a generated key is persisted there instead: it is
//     durable across restarts, cold starts and redeploys, and is never exposed
//     to members.
//  3. Generate a random 32-byte key and store it (once).
//
// The key, plaintext and decrypted values never leave the server.

// Checked in order; the provisioned name wins, older names are still read.
export const VAULT_KEY_NAMES = [
  'IFUND_CONNECTION_SECRET_KEY',
  'IFUND_VAULT_KEY',
  'IFUND_CREDENTIAL_VAULT_KEY',
  'CONNECTION_VAULT_KEY',
];

const ROW_KEY_ID = 'primary';

export type VaultKeySource = 'existing' | 'generated';

export function decodeVaultKey(encoded?: string | null): Uint8Array | null {
  const text = String(encoded || '').trim();
  if (!text) return null;
  try {
    const bytes = Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
    return bytes.length === 32 ? bytes : null;
  } catch {
    return null;
  }
}

export const encodeVaultKey = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));

export async function aesKeyFromBytes(bytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

let cached: { bytes: Uint8Array; source: VaultKeySource } | null = null;

export function clearVaultKeyCache() {
  cached = null;
}

// Resolve the active key. `sr` must be the service-role client: the key record
// is admin-only and never read on behalf of a member.
export async function resolveVaultKey(sr: any): Promise<{ bytes: Uint8Array; source: VaultKeySource }> {
  if (cached) return cached;

  for (const name of VAULT_KEY_NAMES) {
    const bytes = decodeVaultKey(Deno.env.get(name));
    if (bytes) {
      cached = { bytes, source: 'existing' };
      return cached;
    }
  }

  const stored = await readStoredKey(sr);
  if (stored) {
    cached = { bytes: stored, source: 'existing' };
    return cached;
  }

  const generated = crypto.getRandomValues(new Uint8Array(32));
  const generatedB64 = encodeVaultKey(generated);
  await sr.entities.VaultMasterKey.create({
    key_id: ROW_KEY_ID,
    key_b64: generatedB64,
    origin: 'generated',
    created_at: new Date().toISOString(),
  });

  // A concurrent first use may have stored its key first. Re-read and adopt the
  // oldest record so every isolate converges on one key instead of splitting
  // the vault in two.
  const adopted = await readStoredKey(sr, { withBase64: true });
  if (adopted && adopted.base64 && adopted.base64 !== generatedB64) {
    cached = { bytes: adopted.bytes, source: 'existing' };
    return cached;
  }

  cached = { bytes: generated, source: 'generated' };
  return cached;
}

async function readStoredKey(sr: any, options: { withBase64?: boolean } = {}) {
  const rows = await sr.entities.VaultMasterKey
    .filter({ key_id: ROW_KEY_ID }, 'created_date', 20);
  for (const row of Array.isArray(rows) ? rows : []) {
    const bytes = decodeVaultKey(row?.key_b64);
    if (!bytes) continue;
    return options.withBase64 ? { bytes, base64: String(row.key_b64).trim() } : bytes;
  }
  return null;
}

// True when a key can be resolved and actually encrypts and decrypts. Used by
// the admin readiness check; never returns key material.
export async function vaultKeyRoundTrip(sr: any): Promise<{ ok: boolean; source: VaultKeySource | null }> {
  try {
    const { bytes, source } = await resolveVaultKey(sr);
    const key = await aesKeyFromBytes(bytes);
    const probe = 'vault-readiness-' + Date.now();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(probe));
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    const ok = new TextDecoder().decode(decrypted) === probe;
    return { ok, source: ok ? source : null };
  } catch {
    return { ok: false, source: null };
  }
}