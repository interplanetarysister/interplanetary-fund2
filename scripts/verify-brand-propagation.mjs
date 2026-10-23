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

console.log('brand and install-navigation contract: PASS');
