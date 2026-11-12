import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const finance = readFileSync(new URL('../src/pages/FinanceCenter.jsx', import.meta.url), 'utf8');
// '/connect' was retired to a redirect into /admin/integrations; it is no
// longer a lazy page and must not return as an eager import either.
const expectedPages = [
  'Home','Login','Register','ForgotPassword','ResetPassword','Dashboard','Discover',
  'CreateCampaign','CampaignDetail','FinanceCenter','Communications','MissionControlPage',
  'Community','CommunityDetail','Institutions','InstitutionDetail','Analytics','Platform',
  'Onboarding','Profile','Connections','Inbox','FollowedCampaigns','Notifications',
  'Subscriptions','GlobalGlobe','EmbedCampaign','Agents','OpsCenter',
  'OAuthConsent','ExternalAccounts','IntegrationsAdmin','Help','About','Contact','Social',
];

assert.match(app, /import \{ lazy, Suspense, useEffect, useRef \} from ["']react["']/);
assert.match(app, /const Layout = lazy\(\(\) => import\(['"]\.\/components\/Layout['"]\)\)/);
for (const page of expectedPages) {
  assert.match(
    app,
    new RegExp(`const ${page} = lazy\\(\\(\\) => import\\(['"]\\.\\/pages\\/${page}['"]\\)\\)`),
    `${page} must remain route-lazy to protect the initial bundle`,
  );
}
assert.doesNotMatch(
  app,
  /import\s+[A-Za-z0-9_$]+\s+from\s+['"]\.\/pages\//,
  'page modules must not be restored to eager static imports',
);
assert.match(app, /<Suspense\s+fallback=/);
// The protected financial center now owns these nested lazy panels. Preserve
// their split bundles while keeping the old public URLs as route redirects.
for (const page of ['FinancialLedger', 'MyGiving', 'Withdrawals', 'Donors']) {
  assert.match(finance, new RegExp(`const ${page} = lazy\\(\\(\\) => import\\(['"]\\.\\/${page}['"]\\)\\)`), `${page} must remain panel-lazy`);
}
assert.doesNotMatch(finance, /import\s+[A-Za-z0-9_$]+\s+from\s+['"]\.\/(?:FinancialLedger|MyGiving|Withdrawals|Donors)['"]/);
assert.match(finance, /<Suspense\s+fallback=/);
for (const [path, view] of [['giving', 'giving'], ['ledger', 'ledger'], ['withdrawals', 'withdrawals']]) {
  assert.ok(app.includes(`path="/${path}" element={<Navigate to="/finances?view=${view}" replace`), `${path} must keep the financial center redirect`);
}

console.log('Route code-splitting contract verified for all page modules and shared Layout.');
