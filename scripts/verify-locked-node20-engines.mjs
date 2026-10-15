import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// This pre-install diagnostic intentionally uses only Node built-ins so it
// can run in the Node 20 lane before npm ci. It does NOT bypass engine-strict.
// It reports certain incompatibilities, not an exhaustive npm semver proof.
export function confirmedMinimum(range) {
  const match = /^\s*>=\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?\s*$/.exec(String(range || ''));
  return match ? [Number(match[1]), Number(match[2] || 0), Number(match[3] || 0)] : null;
}

function compare(a, b) {
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

export function findConfirmedEngineBlockers(lock, target = '20.20.2') {
  const targetParts = target.split('.').map(Number);
  if (targetParts.length !== 3 || targetParts.some(n => !Number.isInteger(n) || n < 0)) {
    throw new Error('Invalid target Node version: ' + target);
  }

  return Object.entries(lock?.packages || {})
    .filter(([path]) => path.startsWith('node_modules/'))
    .flatMap(([path, entry]) => {
      const requirement = entry?.engines?.node;
      const minimum = confirmedMinimum(requirement);
      if (!minimum || compare(minimum, targetParts) <= 0) return [];
      return [{
        package: path.slice('node_modules/'.length),
        version: entry.version || 'unknown',
        requiredNode: requirement,
        direct: !path.slice('node_modules/'.length).includes('/node_modules/'),
      }];
    })
    .sort((a, b) => a.package.localeCompare(b.package));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv.find(arg => arg.startsWith('--target='))?.slice(9) || '20.20.2';
  const reportOnly = process.argv.includes('--report-only');
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const blockers = findConfirmedEngineBlockers(lock, target);
  if (blockers.length) {
    console.error('Locked dependency engines CONFIRMED incompatible with Node ' + target + ':');
    for (const item of blockers) {
      console.error(' - ' + item.package + '@' + item.version + ': ' + item.requiredNode);
    }
    console.error('This is a lower-bound list (only simple >= version ranges). Do not bypass engine-strict.');
    if (!reportOnly) process.exitCode = 1;
  } else {
    console.log('No incompatible simple >= engine constraints found for Node ' + target + '; npm ci remains the decisive check.');
  }
}
