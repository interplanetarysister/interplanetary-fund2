#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
APP_ID="6a67a778342a8fe05ee79cba"
printf '%s\n' "Building the IFund release..."
./node_modules/.bin/vite build
node scripts/verify-production-build-output.mjs
node scripts/verify-ifund-bundle-graph.mjs
node scripts/test-ifund-login-recovery.mjs
node scripts/test-ifund-device-authorization.mjs
node scripts/verify-ifund-browser-render.mjs
node scripts/verify-ifund-navigation.mjs
./node_modules/.bin/tsc -p jsconfig.json --noEmit
./node_modules/.bin/eslint . --quiet
printf '%s\n' "The local release gate passed. Publishing only the Base44 website files."
base44 --app-id "$APP_ID" site deploy --no-build --yes
printf '%s\n' "Checking production in Chromium..."
IFUND_SMOKE_URL=https://interplanetaryfund.com node scripts/verify-ifund-browser-render.mjs
IFUND_SMOKE_URL=https://interplanetaryfund.com node scripts/verify-ifund-navigation.mjs
printf '%s\n' "IFund published and production navigation verified."
