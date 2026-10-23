import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');

test('owner-link has an exact Worker route for both hostnames, without changing DNS', () => {
  for (const hostname of ['interplanetaryfund.com', 'www.interplanetaryfund.com']) {
    const route = `pattern = "${hostname}/api/v1/migration/owner-link"`;
    assert.equal(config.split(route).length - 1, 1, `missing or duplicated ${hostname} route`);
  }
  assert.match(config, /# These hostname routes require authoritative DNS on Cloudflare/);
});

test('owner-link is handled before SPA fallback, but remains default-off', () => {
  const first = config.match(/run_worker_first\s*=\s*\[([\s\S]*?)\]/)?.[1] || '';
  assert.match(first, /"\/api\/v1\/migration\/owner-link"/);
  const vars = config.split('[vars]')[1]?.split(/\n\[/)[0] || '';
  assert.doesNotMatch(vars, /IFUND_OWNER_LINK_ENABLED\s*=/);
});

test('native rate-limit binding is uniquely named and intentionally bounded', () => {
  const blocks = [...config.matchAll(/^\[\[ratelimits\]\]$/gm)];
  assert.equal(blocks.length, 1);
  const block = config.slice(blocks[0].index);
  assert.match(block, /name\s*=\s*"IFUND_OWNER_LINK_LIMITER"/);
  assert.match(block, /namespace_id\s*=\s*"58162"/);
  assert.match(block, /\[ratelimits\.simple\]\s*\nlimit\s*=\s*5\s*\nperiod\s*=\s*60/);
});

test('all existing routes and assets remain configured', () => {
  for (const hostname of ['interplanetaryfund.com', 'www.interplanetaryfund.com']) {
    for (const path of ['/api/health*', '/api/v1/migration/auth/session',
      '/api/v1/migration/campaigns', '/api/v1/agent/*', '/api/mcp*',
      '/v1/admin/agents/*', '/.well-known/oauth-*', '/.well-known/openid-configuration*']) {
      assert.ok(config.includes(`pattern = "${hostname}${path}"`), `missing ${hostname}${path}`);
    }
  }
  assert.match(config, /not_found_handling = "single-page-application"/);
  assert.match(config, /\[previews\]/);
  assert.match(config, /keep_vars = true/);
});

test('binding does not enable a paid service or expose secrets in source', () => {
  assert.doesNotMatch(config, /\[\[durable_objects\.bindings\]\]|\[\[kv_namespaces\]\]|\[\[d1_databases\]\]/);
  assert.doesNotMatch(config, /IFUND_SUPABASE_SERVICE_ROLE_KEY\s*=/);
  assert.doesNotMatch(config, /IFUND_OWNER_LINK_CSRF_SECRET\s*=/);
  assert.match(config, /counters\s*\n# are approximate and local to each Cloudflare location/);
});
