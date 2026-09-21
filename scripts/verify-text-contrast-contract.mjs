import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/components/Layout.jsx', import.meta.url), 'utf8');

assert.match(css, /body\s*\{[\s\S]*?bg-background text-foreground/, 'body must define semantic background and foreground');
assert.match(css, /\.deep-space\s*\{[\s\S]*?color:\s*hsl\(var\(--sidebar-foreground\)\)/, 'deep-space surfaces must set a readable inherited foreground');
assert.match(layout, /<main className="[^"]*bg-background[^"]*text-foreground/, 'shared app main must explicitly pair background and foreground');
assert.match(layout, /<div className="min-h-screen bg-background text-foreground"/, 'shared app shell must explicitly pair background and foreground');

console.log('Shared text contrast contract passed.');
