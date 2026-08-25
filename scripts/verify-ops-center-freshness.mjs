import fs from 'node:fs';
import path from 'node:path';

const ops = fs.readFileSync('src/pages/OpsCenter.jsx', 'utf8');
const root = 'src';
const hits = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(jsx|js|tsx|ts)$/.test(entry.name)) {
      const text = fs.readFileSync(full, 'utf8');
      if (text.includes('FundMigrationDashboard')) hits.push(full);
    }
  }
}
walk(root);

if (!ops.includes('disabled') || !ops.includes('aria-disabled="true"')) throw new Error('FAIL: Fund Migration tab is not disabled in Ops Center.');
if (!ops.includes('lastConvexRefreshAt')) throw new Error('FAIL: Convex refresh timestamp is not tracked separately.');
if (!ops.includes('load({ markConvexRefresh: true })')) throw new Error('FAIL: only successful syncFromConvex path may mark a Convex refresh.');
if (!ops.includes('No successful Convex refresh is being claimed.')) throw new Error('FAIL: ordinary mirror load is not explicitly distinguished from Convex refresh.');
if (hits.length !== 2 || !hits.includes('src/pages/OpsCenter.jsx') || !hits.includes('src/components/ops/FundMigrationDashboard.jsx')) {
  throw new Error(`FAIL: unexpected FundMigrationDashboard routes/imports: ${hits.join(', ')}`);
}

console.log('PASS: Ops Center distinguishes ordinary Base44 mirror loads from confirmed Convex refreshes and keeps Fund Migration unreachable through enabled navigation until the P0 workflow is published.');
