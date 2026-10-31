import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');

test('owner-link is not added to custom-domain routing or DNS configuration', () => {
  for (const hostname of ['interplanetaryfund.com', 'www.interplanetaryfund.com']) {
    assert.equal(config.split(`pattern = "${hostname}/api/v1/migration/owner-link"`).length - 1, 0);
  }
  assert.doesNotMatch(config, /IFUND_OWNER_LINK_LIMITER|IFUND_OWNER_LINK_ENABLED/);
  assert.match(config, /# These hostname routes require authoritative DNS on Cloudflare/);
});

test('all pre-existing routes and assets remain configured unchanged', () => {
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

test('owner-link secrets and extra paid or metered bindings are absent from source', () => {
  assert.doesNotMatch(config, /\[\[ratelimits\]\]|\[\[durable_objects\.bindings\]\]|\[\[kv_namespaces\]\]|\[\[d1_databases\]\]/);
  assert.doesNotMatch(config, /IFUND_SUPABASE_SERVICE_ROLE_KEY\s*=/);
  assert.doesNotMatch(config, /IFUND_OWNER_LINK_CSRF_SECRET\s*=/);
});
