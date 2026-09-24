import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const syncSource = read('base44/functions/syncGitHub/entry.ts');
const runbook = read('docs/deferred-base44-workflows.md');
const pkg = JSON.parse(read('package.json'));
const nodeVersion = read('.node-version').trim();
const nvmrc = read('.nvmrc').trim();
const quality = read('.github/workflows/quality-gates.yml');

assert.equal(nodeVersion, '20', '.node-version must preserve the Base44 Node 20 compatibility baseline');
assert.equal(nvmrc, '20', '.nvmrc must preserve the Base44 Node 20 compatibility baseline');
assert.equal(pkg.engines?.node, '>=20 <23', 'package engine must preserve Node 20 and Node 22 compatibility');
assert.match(quality, /node-version:\s*20\b/, 'quality gates must retain the Base44 Node 20 compatibility lane');
assert.match(quality, /node-version:\s*22\b/, 'quality gates must retain the Node 22 release lane');

function stripJsonComments(source) {
  let output = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      output += '\n';
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
      index += 1;
      continue;
    }
    output += char;
  }
  return output;
}

function stripTrailingJsonCommas(source) {
  let output = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === ',') {
      let lookahead = index + 1;
      while (/\s/.test(source[lookahead] || '')) lookahead += 1;
      if (source[lookahead] === '}' || source[lookahead] === ']') continue;
    }
    output += char;
  }
  return output;
}

function parseJsonc(source, name) {
  try {
    return JSON.parse(stripTrailingJsonCommas(stripJsonComments(source)));
  } catch (error) {
    throw new Error(name + ' is not valid JSONC: ' + error.message);
  }
}

function workflowInvokesSyncGitHub(value) {
  if (Array.isArray(value)) return value.some(workflowInvokesSyncGitHub);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => {
    const normalizedKey = key.replace(/[_-]/g, '').toLowerCase();
    if (
      typeof child === 'string' &&
      ['functionname', 'function', 'call'].includes(normalizedKey) &&
      child === 'syncGitHub'
    ) return true;
    return workflowInvokesSyncGitHub(child);
  });
}

function assertNoWorkflowInvocation(entries) {
  for (const [name, source] of entries) {
    assert.equal(
      workflowInvokesSyncGitHub(parseJsonc(source, name)),
      false,
      name + ' must not invoke syncGitHub until workflow identity is server-verifiable'
    );
  }
}

assert.throws(
  () => assertNoWorkflowInvocation([
    [
      'Renamed Scheduled Check.jsonc',
      '{\n// alternate filename and escaped function value\n"definition":{"do":[{"call":"invoke_backend_function","with":{"function_name":"sync\\u0047itHub",},},]},\n}'
    ]
  ]),
  /Renamed Scheduled Check\.jsonc must not invoke syncGitHub/,
  'escaped function names and alternate workflow filenames must not bypass the gate'
);

const workflowDir = new URL('base44/workflows/', root);
const workflowEntries = readdirSync(workflowDir)
  .filter((name) => name.endsWith('.jsonc'))
  .map((name) => [name, read('base44/workflows/' + name)]);
assertNoWorkflowInvocation(workflowEntries);

function decodeStaticStringBody(body) {
  return body
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\(["'\\])/g, '$1');
}

function scanJavaScript(source) {
  let code = '';
  const strings = [];
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      code += '\n';
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
      index += 1;
      code += ' ';
      continue;
    }
    const quoteCode = char.charCodeAt(0);
    if (char !== '"' && char !== "'" && quoteCode !== 96) {
      code += char;
      continue;
    }
    const quote = char;
    let token = char;
    let body = '';
    let escaped = false;
    index += 1;
    for (; index < source.length; index += 1) {
      const current = source[index];
      token += current;
      if (escaped) {
        body += '\\' + current;
        escaped = false;
        continue;
      }
      if (current === '\\') {
        escaped = true;
        continue;
      }
      if (current === quote) break;
      body += current;
    }
    code += token;
    strings.push(decodeStaticStringBody(body.replace(/\$\{[\s\S]*?\}/g, ' ')));
  }
  const jsxText = [...code.matchAll(/>([^<>{]+)</g)]
    .map((match) => match[1].replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return { code, humanText: [...strings, ...jsxText] };
}

function readStaticExpression(code, start) {
  let expression = '';
  let quote = null;
  let escaped = false;
  let depth = 0;
  for (let index = start; index < code.length; index += 1) {
    const char = code[index];
    if (quote) {
      expression += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      expression += char;
      continue;
    }
    if (char === '(' || char === '[' || char === '{') depth += 1;
    if (char === ')' || char === ']' || char === '}') {
      if (depth === 0) break;
      depth -= 1;
    }
    if (char === ',' && depth === 0) break;
    expression += char;
  }
  return expression.trim();
}

function evaluateStaticString(expression, bindings) {
  let index = 0;
  let output = '';
  let foundValue = false;
  let expectValue = true;
  while (index < expression.length) {
    while (/\s/.test(expression[index] || '')) index += 1;
    if (index >= expression.length) break;
    if (!expectValue) {
      if (expression[index] !== '+') return null;
      index += 1;
      expectValue = true;
      continue;
    }
    const char = expression[index];
    if (char === '"' || char === "'") {
      const quote = char;
      let body = '';
      let escaped = false;
      index += 1;
      for (; index < expression.length; index += 1) {
        const current = expression[index];
        if (escaped) {
          body += '\\' + current;
          escaped = false;
          continue;
        }
        if (current === '\\') {
          escaped = true;
          continue;
        }
        if (current === quote) break;
        body += current;
      }
      if (expression[index] !== quote) return null;
      index += 1;
      output += decodeStaticStringBody(body);
    } else {
      const identifier = /^[A-Za-z_$][\w$]*/.exec(expression.slice(index));
      if (!identifier || !bindings.has(identifier[0])) return null;
      output += bindings.get(identifier[0]);
      index += identifier[0].length;
    }
    foundValue = true;
    expectValue = false;
  }
  return foundValue && !expectValue ? output : null;
}

function collectStaticBindings(code) {
  const bindings = new Map();
  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false;
    const declarations = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g;
    for (const match of code.matchAll(declarations)) {
      const value = evaluateStaticString(match[2], bindings);
      if (value !== null && bindings.get(match[1]) !== value) {
        bindings.set(match[1], value);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return bindings;
}

function discoverInvokedFunctions(source) {
  const { code } = scanJavaScript(source);
  const bindings = collectStaticBindings(code);
  const invoked = [];
  const callPattern = /(?:\.\s*invoke|\[\s*["']invoke["']\s*\])\s*\(/g;
  for (const match of code.matchAll(callPattern)) {
    const expression = readStaticExpression(code, match.index + match[0].length);
    const value = evaluateStaticString(expression, bindings);
    if (value !== null) invoked.push(value);
  }
  return invoked;
}

const invocationFixture =
  'const prefix = "sync"; const target = prefix + "\\u0047itHub"; base44.functions.invoke(target, { direction: "both" });';
assert.ok(
  discoverInvokedFunctions(invocationFixture).includes('syncGitHub'),
  'variable, concatenated, and escaped static invocation expressions must be discovered'
);

function isMisleadingGitHubClaim(text) {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  const hasGitHub = /\bGitHub\b/i.test(normalized);
  const hasSyncWord = /\b(?:sync(?:ed|ing)?|synchroniz(?:e|es|ed|ing|ation))\b/i.test(normalized);
  const hasOutcome = /\b(?:success(?:ful|fully)?|succeed(?:ed)?|complete(?:d)?|fail(?:ed|ure)?|error|issue|skipp(?:ed)?|unable)\b|could not/i.test(normalized);
  const isImperative = /\b(?:sync|synchronize)\s+(?:with\s+)?GitHub\b/i.test(normalized);
  return hasGitHub && hasSyncWord && (hasOutcome || isImperative);
}

function assertNoMisleadingGitHubClaims(texts, path) {
  const offending = texts.filter(isMisleadingGitHubClaim);
  assert.deepEqual(
    offending,
    [],
    path + ' contains misleading human-facing GitHub synchronization claim(s): ' + offending.join(' | ')
  );
}

for (const fixture of [
  'Sync GitHub',
  'GitHub sync completed successfully.',
  '[GitHub Synchronization] One or more operations failed',
  'Synchronization with GitHub failed.',
  'Unable to synchronize GitHub.'
]) {
  assert.throws(
    () => assertNoMisleadingGitHubClaims([fixture], 'Agent2NegativeFixture'),
    /misleading human-facing GitHub synchronization claim/,
    'negative fixture must fail: ' + fixture
  );
}
assertNoMisleadingGitHubClaims(
  ['syncGitHub', 'github_sync', 'Base44 native GitHub synchronization control'],
  'identifier-and-capability-positive-fixtures'
);

assert.match(syncSource, /const REPO = 'interplanetarysister\/interplanetary-fund2'/);
assert.match(syncSource, /const BRANCH = 'main'/);
assert.match(syncSource, /if \(!user\) return Response\.json\(\{ error: 'Unauthorized' \}/);
assert.match(syncSource, /user\.role !== 'admin'/);
assert.doesNotMatch(syncSource, /initiator_type|isWorkflow/,
  'caller-supplied workflow labels must never bypass authentication');
assert.match(syncSource, /assertPlatformAccess\(sr, 'github'\)/);
assert.doesNotMatch(syncSource, /Deno\.Command|child_process|execSync|spawnSync/,
  'Base44 verification must use the provider API, not shell git');
assert.match(syncSource, /checked_at: now/);
assert.doesNotMatch(syncSource, /synced_at: now/);
assert.match(syncSource, /Notification\.create\(/);
assert.match(syncSource, /title:\s*'\[GitHub Verification\] One or more connection checks failed'/);
assert.match(syncSource, /body:[^\n]*GitHub connection verification failed for check\(s\)/);
assertNoMisleadingGitHubClaims(scanJavaScript(syncSource).humanText, 'base44/functions/syncGitHub/entry.ts');

function collectSourceFiles(directory, relative = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const childRelative = relative ? relative + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      return collectSourceFiles(new URL(entry.name + '/', directory), childRelative);
    }
    return /\.(?:js|jsx|ts|tsx)$/.test(entry.name) ? [childRelative] : [];
  });
}

const sourceFiles = collectSourceFiles(new URL('src/', root))
  .map((path) => ['src/' + path, read('src/' + path)]);
const liveCallers = sourceFiles.filter(([, source]) =>
  discoverInvokedFunctions(source).includes('syncGitHub')
);

assert.ok(
  liveCallers.some(([path]) => path === 'src/pages/IntegrationsAdmin.jsx'),
  'IntegrationsAdmin must remain covered as a live caller'
);
assert.ok(
  liveCallers.some(([path]) => path === 'src/components/admin/IntegrationDetailPanel.jsx'),
  'IntegrationDetailPanel must remain covered as a live caller'
);
for (const [path, source] of liveCallers) {
  const humanText = scanJavaScript(source).humanText;
  assertNoMisleadingGitHubClaims(humanText, path);
  assert.ok(
    humanText.some((text) => /Verify GitHub|GitHub (?:status )?verifi|connection verification/i.test(text)),
    path + ' must describe the operation as GitHub connection verification'
  );
}

for (const line of runbook.split('\n')) {
  assertNoMisleadingGitHubClaims([line], 'docs/deferred-base44-workflows.md');
}
assert.match(runbook, /scheduled GitHub workflow definition is intentionally absent/i);
assert.match(runbook, /caller-supplied[\s\S]*initiator_type/i);
assert.match(runbook, /authenticated\s+administrator/i);
assert.match(runbook, /server-verifiable workflow identity/i);

console.log('Base44 GitHub verification authorization and truthfulness contract passed.');
