import fs from 'node:fs';
import assert from 'node:assert/strict';

const panel = fs.readFileSync('src/components/connections/PasswordVaultPanel.jsx', 'utf8');
const vault = fs.readFileSync('src/lib/credentialVault.js', 'utf8');
assert.match(panel, /if \(saved\) await unlockVaultEntry\(saved, passphrase\);/, 'Replacement must authenticate existing passphrase before encrypting');
assert.ok(panel.indexOf('if (saved) await unlockVaultEntry(saved, passphrase);') < panel.indexOf('const sealed = await lockVaultEntry'), 'Verify before replacing entry');
assert.match(panel, /document\.addEventListener\("visibilitychange", onHidden\)/);
assert.match(panel, /document\.removeEventListener\("visibilitychange", onHidden\)/);
assert.match(panel, /document\.visibilityState === "hidden"/);
assert.match(panel, /setUnlocked\(false\); setVisible\(false\)/);
assert.match(vault, /AES-GCM/);
assert.match(vault, /PBKDF2/);
console.log('PASS: vault replacement requires existing passphrase; background auto-lock; encryption retained.');
