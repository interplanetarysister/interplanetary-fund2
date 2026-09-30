import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const layout = readFileSync(new URL('src/components/Layout.jsx', root), 'utf8');
const fixture = mkdtempSync(join(tmpdir(), 'ifund-text-contrast-'));

try {
  mkdirSync(join(fixture, 'scripts'));
  mkdirSync(join(fixture, 'src/components'), { recursive: true });
  mkdirSync(join(fixture, 'src'), { recursive: true });
  for (const file of ['scripts/verify-text-contrast-contract.mjs', 'src/index.css']) {
    writeFileSync(join(fixture, file), readFileSync(new URL(file, root)));
  }

  const shellPattern = /return\s*\(\s*<div\s+className="([^"]*)"/;
  const mainPattern = /<main\s+className="([^"]*)"/;

  function check(source, expectedError = null) {
    writeFileSync(join(fixture, 'src/components/Layout.jsx'), source);
    const result = spawnSync(process.execPath, [join(fixture, 'scripts/verify-text-contrast-contract.mjs')], { encoding: 'utf8' });
    assert.ifError(result.error);
    if (expectedError) {
      assert.equal(result.status, 1, 'invalid contrast fixture must fail');
      assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(expectedError));
    } else {
      assert.equal(result.status, 0, result.stderr);
    }
  }

  check(layout);
  for (const height of ['min-h-screen', 'min-h-dvh']) {
    check(layout.replace(shellPattern, (tag, classes) => tag.replace(classes, `text-foreground w-full ${height} bg-background overflow-x-hidden`)));
  }

  for (const [surface, pattern] of [['shell', shellPattern], ['main', mainPattern]]) {
    assert.ok(pattern.test(layout), `fixture must contain ${surface}`);
    for (const required of ['bg-background', 'text-foreground']) {
      for (const replacement of ['', `hover:${required}`, `${required}-extra`]) {
        const malformed = layout.replace(pattern, (tag, classes) => tag.replace(
          classes,
          classes.split(/\s+/).map((token) => token === required ? replacement : token).join(' '),
        ));
        check(malformed, `shared app ${surface} must include ${required}`);
      }
    }
  }

  console.log('Text contrast contract positive and negative cases passed.');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
