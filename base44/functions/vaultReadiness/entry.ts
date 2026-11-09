import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { vaultKeyRoundTrip } from '../../shared/vaultKey.ts';

// Admin-only credential-vault readiness. Answers "can the server encrypt and
// decrypt provider credentials right now?" without needing a real provider key,
// and reports where the key came from. Never returns key material or any
// decrypted value.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    if (guard.user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const sr = base44.asServiceRole;
    const { ok, source } = await vaultKeyRoundTrip(sr);

    const rows = await sr.entities.UserCredentialVault
      .filter({}, '-created_date', 500)
      .catch(() => []);
    const list = Array.isArray(rows) ? rows : [];
    const serverRecords = list.filter((row) => String(row?.ciphertext || '').startsWith('enc:v1:')).length;
    const passphraseRecords = list.length - serverRecords;

    return Response.json({
      configured: ok,
      key_source: source || null,
      record_count: serverRecords,
      // Owner-passphrase entries written by the browser vault. They are separate
      // by design and cannot be opened with the server key; they are listed so
      // their existence is visible rather than silently ignored.
      passphrase_record_count: passphraseRecords,
      scanned_records: list.length,
    });
  } catch (error) {
    console.error('vaultReadiness:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ configured: false, key_source: null, record_count: 0 }, { status: 500 });
  }
}