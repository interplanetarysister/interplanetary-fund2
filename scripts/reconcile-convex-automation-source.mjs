#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const repoRoot = process.cwd();
const targets = [
  'runAllAgentAutomation',
  'runCoordinatorAutomation',
  'runScoutAutomation',
  'checkSiteHealth',
  'runPostProductionAutomation',
  'cron_commit_mut',
  'distributedPosts',
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (/\.(js|jsx|ts|tsx|json|jsonc|md|yml|yaml)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const files = await walk(repoRoot);
const evidence = Object.fromEntries(targets.map((target) => [target, []]));

for (const file of files) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    continue;
  }
  const lines = text.split(/\r?\n/);
  for (const target of targets) {
    const matches = [];
    lines.forEach((line, index) => {
      if (line.includes(target)) matches.push(index + 1);
    });
    if (matches.length) evidence[target].push({ path: relative(repoRoot, file), lines: matches });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  repository: process.env.GITHUB_REPOSITORY ?? 'unknown',
  commit: process.env.GITHUB_SHA ?? 'unknown',
  sourceOnlyEvidence: evidence,
  unresolvedTargets: targets.filter((target) => evidence[target].length === 0),
  interpretation: 'Source inspection only. Missing entries are UNKNOWN and must not be treated as proof that deployed Convex functionality is absent. Line numbers are review anchors, not runtime evidence.',
};

console.log(JSON.stringify(report, null, 2));
