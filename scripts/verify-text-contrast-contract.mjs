import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/components/Layout.jsx', import.meta.url), 'utf8');

assert.match(css, /body\s*\{[\s\S]*?bg-background text-foreground/, 'body must define semantic background and foreground');
assert.match(css, /\.deep-space\s*\{[\s\S]*?color:\s*hsl\(var\(--sidebar-foreground\)\)/, 'deep-space surfaces must set a readable inherited foreground');

const hasSemanticPair = (className) => {
  const tokens = className.trim().split(/\s+/);
  return tokens.includes('bg-background') && tokens.includes('text-foreground');
};

const mainMatch = layout.match(/<main\s+className="([^"]*)"/);
assert.ok(mainMatch && hasSemanticPair(mainMatch[1]), 'shared app main must explicitly pair background and foreground');

const shellMatch = layout.match(/<div\s+className="([^"]*)"/);
assert.ok(shellMatch, 'shared app shell must be present');
const shellTokens = shellMatch[1].trim().split(/\s+/);
assert.ok(
  shellTokens.includes('bg-background') &&
  shellTokens.includes('text-foreground') &&
  (shellTokens.includes('min-h-screen') || shellTokens.includes('min-h-dvh')),
  'shared app shell must explicitly pair background and foreground with a supported viewport-height token',
);

console.log('Shared text contrast contract passed.');
