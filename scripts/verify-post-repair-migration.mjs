import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');

const connections = read('src/pages/Connections.jsx');
const analytics = read('src/pages/Analytics.jsx');
const ops = read('src/pages/OpsCenter.jsx');
const globe = read('src/components/globe/CampaignGlobe.jsx');
const integration = read('src/pages/IntegrationsAdmin.jsx');
const managed = read('base44/functions/requestManagedConnectionAction/entry.ts');
const browser = read('base44/functions/runBrowserConnection/entry.ts');
const providers = read('base44/shared/providerCapabilities.ts');

assert.match(connections, /requestGeneration = useRef/);
assert.match(connections, /mountedRef = useRef/);
assert.match(connections, /Malformed connections response/);
assert.match(connections, /Malformed sync response/);
assert.match(connections, /aria-live="polite"/);
assert.doesNotMatch(connections, /setSyncResult\(data\)/);

assert.match(analytics, /requestGeneration = useRef/);
assert.match(analytics, /Malformed donation response/);
assert.match(analytics, /SAFE_ANALYTICS_ERROR/);

assert.match(ops, /requestGeneration = useRef/);
assert.match(ops, /providerState/);
assert.match(ops, /No synthetic agent data is shown/);
assert.doesNotMatch(ops, /IN_APP_AGENTS/);
assert.match(ops, /const ok = await load\(\)/);

assert.match(globe, /touchAction = "pan-y"/);
assert.match(globe, /setPointerCapture/);
assert.match(globe, /pointercancel/);
assert.match(globe, /MOBILE_BREAKPOINT/);
assert.match(globe, /Number\.isFinite\(c\?\.location_lat\)/);

assert.match(integration, /REQUEST_TIMEOUT_MS/);
assert.match(managed, /hasManagedConnections/);
assert.match(browser, /browser_execution_deferred/);
assert.doesNotMatch(providers, /balance_read:true/);

console.log('post-repair migration completion contract: PASS');
