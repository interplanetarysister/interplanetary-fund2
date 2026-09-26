import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Help.jsx', 'utf8');
const required = [
  'SAFE_HELP_ERROR',
  'parseArticles',
  'requestGeneration',
  'role="alert"',
  'if (!loadError && !filtered.length)',
];
for (const token of required) {
  if (!source.includes(token)) throw new Error(`Missing Help safe-loading contract: ${token}`);
}
if (/HelpArticle\.list\([^\n]+\.catch\(\(\)\s*=>\s*setArticles\(\[\]\)\)/.test(source)) {
  throw new Error('Help Center still masks article-load failures as an empty catalog');
}
if (/catch\(\(\)\s*=>\s*\{\}\)/.test(source)) {
  throw new Error('Help Center still silently suppresses auth-load failure');
}
console.log('Help safe-loading verifier passed.');
