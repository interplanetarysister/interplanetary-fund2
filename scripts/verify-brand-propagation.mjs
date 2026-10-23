import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const brand = read('src/components/brand/brand.js');
const logo = read('src/components/brand/BrandLogo.jsx');
const app = read('src/App.jsx');
const manifest = JSON.parse(read('public/manifest.json'));
const index = read('index.html');
const layout = read('src/components/Layout.jsx');
const home = read('src/pages/Home.jsx');
const download = read('src/pages/DownloadApp.jsx');

assert.match(brand, /BRAND_MARK = "\/interplanetary-planet\.svg"/);
assert.match(logo, /src=\{BRAND_MARK\}/);
assert.doesNotMatch(logo, /FALLBACK_IMAGE/);
assert.match(app, /<BrandLogo size="lg" showName=\{false\}/);
assert.ok(manifest.icons.some((icon) => icon.src === '/icon-192.jpg' && icon.sizes === '192x192'));
assert.ok(manifest.icons.some((icon) => icon.src === '/icon-512.jpg' && icon.sizes === '512x512'));
assert.ok(index.includes('rel="icon" type="image/svg+xml" href="/interplanetary-planet.svg?v=2"'));
assert.equal(fs.existsSync('public/interplanetary-planet.svg'), true);

// Prevent install links from becoming hidden, inaccessible or misleading while
// there is no verified public signed-APK release.
assert.ok(app.includes('<Route path="/download" element={<DownloadApp />} />'));
assert.ok(layout.includes('{ to: "/download", label: "Download IFund"'));
assert.ok(home.includes('to="/download"'));
assert.ok(download.includes('beforeinstallprompt'));
assert.ok(download.includes('Add to Home Screen'));
assert.ok(!download.includes('/releases/download/'));

// Signed-in dashboard shortcuts reuse the catalog and the same branded logos.
const dashboard = read('src/pages/Dashboard.jsx');
const shortcuts = read('src/components/dashboard/QuickConnectPlatforms.jsx');
const catalog = read('src/components/connections/platformCatalog.js');
const platformLogo = read('src/components/connections/PlatformLogo.jsx');
const connections = read('src/pages/Connections.jsx');
assert.ok(dashboard.includes('import QuickConnectPlatforms'));
assert.ok(dashboard.indexOf('<QuickConnectPlatforms />') < dashboard.indexOf('Your campaigns'));
const favorites = ['facebook', 'instagram', 'tiktok', 'youtube', 'x', 'linkedin', 'pinterest', 'gofundme', 'kofi', 'patreon'];
for (const id of favorites) {
  assert.ok(shortcuts.includes('"' + id + '"'), 'Missing favorite: ' + id);
  assert.ok(catalog.includes('id: "' + id + '"'), 'Missing catalog platform: ' + id);
}
assert.ok(shortcuts.includes('/connections?view='));
assert.ok(shortcuts.includes('encodeURIComponent(platform.id)'));
assert.ok(shortcuts.includes('<PlatformLogo platform={platform} size="sm" />'));
assert.ok(platformLogo.includes('size = "md"'));
assert.ok(connections.includes('get("view")'));
assert.ok(connections.includes('id="selected-platform-status"'));
assert.ok(connections.includes('lifecycleHealth(lifecycleMap[viewedConnection.id])'));
assert.ok(connections.includes('Connect another account'));
assert.ok(connections.includes('Connect ${viewedPlatform.name}'));
assert.ok(!shortcuts.includes('verifyPlatformConnection'), 'Dashboard shortcut must not auto-probe providers');
assert.ok(!shortcuts.includes('connectAppUser'), 'Dashboard shortcut must not auto-authorize OAuth');

console.log('brand and install-navigation contract: PASS');
