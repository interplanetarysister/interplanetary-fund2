import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/components/Layout.jsx', import.meta.url), 'utf8');

function hasStaticElementClasses(source, tagName, requiredClasses) {
  const openingTag = new RegExp(
    '<' + tagName + '\\b[^>]*\\bclassName\\s*=\\s*"([^"]*)"',
    'g'
  );

  return [...source.matchAll(openingTag)].some((match) => {
    const classes = new Set(match[1].trim().split(/\s+/).filter(Boolean));
    return requiredClasses.every((className) => classes.has(className));
  });
}

function ruleAppliesClasses(source, selector, requiredClasses) {
  const rule = new RegExp(selector + '\\s*\\{([^}]*)\\}', 'g');

  return [...source.matchAll(rule)].some((match) => {
    const apply = match[1].match(/@apply\s+([^;]+);/);
    if (!apply) return false;
    const classes = new Set(apply[1].trim().split(/\s+/).filter(Boolean));
    return requiredClasses.every((className) => classes.has(className));
  });
}

assert.ok(
  ruleAppliesClasses(css, 'body', ['bg-background', 'text-foreground']),
  'body must define semantic background and foreground regardless of class order'
);
assert.match(
  css,
  /\.deep-space\s*\{[\s\S]*?color:\s*hsl\(var\(--sidebar-foreground\)\)/,
  'deep-space surfaces must set a readable inherited foreground'
);
assert.ok(
  hasStaticElementClasses(layout, 'main', ['bg-background', 'text-foreground']),
  'shared app main must explicitly pair background and foreground regardless of class order'
);
assert.ok(
  ['min-h-screen', 'min-h-dvh'].some((heightClass) =>
    hasStaticElementClasses(layout, 'div', [heightClass, 'bg-background', 'text-foreground'])
  ),
  'shared app shell must pair a viewport-height class with semantic background and foreground'
);

// Regression checks for the semantic matcher: harmless class reordering must pass,
// while removal of either color role must fail.
assert.equal(
  hasStaticElementClasses(
    '<div className="text-foreground min-h-dvh bg-background">',
    'div',
    ['min-h-dvh', 'bg-background', 'text-foreground']
  ),
  true,
  'semantic class checks must accept reordered class tokens'
);
assert.equal(
  hasStaticElementClasses(
    '<div className="min-h-dvh bg-background">',
    'div',
    ['min-h-dvh', 'bg-background', 'text-foreground']
  ),
  false,
  'semantic class checks must reject a missing foreground role'
);
assert.equal(
  ruleAppliesClasses('body { @apply bg-background font-body; }', 'body', ['bg-background', 'text-foreground']),
  false,
  'semantic CSS checks must reject a missing foreground role'
);

console.log('Shared text contrast contract passed.');
