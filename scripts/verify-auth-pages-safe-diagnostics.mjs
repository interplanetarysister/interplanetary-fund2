import fs from 'node:fs';

const files = ['src/pages/Login.jsx', 'src/pages/Register.jsx', 'src/pages/ResetPassword.jsx'];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes('getSafeAuthError')) throw new Error(`${file}: missing bounded auth helper`);
  if (/\b(?:e|err)\.message\b/.test(source)) throw new Error(`${file}: raw exception message access remains`);
  if (!source.includes('finally')) throw new Error(`${file}: missing loading reset finally block`);
}
console.log('auth-page safe-diagnostics contract passed');
