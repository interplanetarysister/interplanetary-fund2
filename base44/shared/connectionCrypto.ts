// Server-only credential encryption. AES-GCM, 32-byte key, formatted
// "enc:v1:<iv>:<ciphertext>". There is no plaintext fallback: if a key cannot be
// resolved, every write fails closed.
//
// The key comes from vaultKey.ts, which reads an operator-provisioned secret if
// one exists and otherwise generates and persists one on first use, so the
// vault works without any manual setup.
import { resolveVaultKey, aesKeyFromBytes } from './vaultKey.ts';

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

export async function encryptConnectionSecret(value: string, sr: any): Promise<string> {
  const { bytes } = await resolveVaultKey(sr);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await aesKeyFromBytes(bytes),
    new TextEncoder().encode(value)
  );
  return 'enc:v1:' + toBase64(iv) + ':' + toBase64(new Uint8Array(encrypted));
}

export async function decryptConnectionSecret(value: string, sr: any): Promise<string> {
  const parts = String(value || '').split(':');
  if (parts.length !== 4 || parts[0] !== 'enc' || parts[1] !== 'v1') {
    throw new Error('invalid_encrypted_credential');
  }
  const { bytes } = await resolveVaultKey(sr);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(parts[2]) },
    await aesKeyFromBytes(bytes),
    fromBase64(parts[3])
  );
  return new TextDecoder().decode(decrypted);
}