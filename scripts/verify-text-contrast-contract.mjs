import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/components/Layout.jsx', import.meta.url), 'utf8');

function requireMatch(source, pattern, message) {
  assert.match(source, pattern, message);
}

requireMatch(
  css,
  /body\s*\{[\s\S]*?@apply\s+bg-background\s+text-foreground\b/,
  'body must define semantic background and foreground'
);
requireMatch(
  css,
  /\.deep-space\s*\{[\s\S]*?\bcolor\s*:\s*hsl\(var\(--sidebar-foreground\)\)/,
  'deep-space surfaces must set a readable inherited foreground'
);
requireMatch(
  layout,
  /<main\s+className="[^"]*\bbg-background\b[^"]*\btext-foreground\b/,
  'shared app main must explicitly pair background and foreground'
);
requireMatch(
  layout,
  /<div\s+className="[^"]*\bmin-h-(?:screen|dvh)\b[^"]*\bbg-background\b[^"]*\btext-foreground\b/,
  'shared app shell must explicitly pair background and foreground'
);

console.log('Shared text contrast contract passed.');
