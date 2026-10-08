import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const dialog = read('src/components/ui/dialog.jsx');
const alertDialog = read('src/components/ui/alert-dialog.jsx');
const sheet = read('src/components/ui/sheet.jsx');
const css = read('src/index.css');
const globe = read('src/components/globe/CampaignGlobe.jsx');

for (const source of [dialog, alertDialog]) {
  assert.match(source, /w-\[calc\(100%_-_2rem\)\]/);
  assert.match(source, /max-h-\[calc\(100dvh_-_2rem\)\]/);
  assert.match(source, /overflow-y-auto/);
  assert.match(source, /p-4 sm:p-6/);
}
assert.match(sheet, /overflow-y-auto overscroll-contain/);
assert.match(sheet, /min-h-\[44px\] min-w-\[44px\]/);
assert.match(css, /touch-action: pan-y/);
assert.match(css, /overflow-x: hidden/);
assert.match(globe, /touchAction = "pan-y"/);
assert.doesNotMatch(globe, /touch-none/);

console.log('mobile dialog and single-touch layout contract: PASS');
