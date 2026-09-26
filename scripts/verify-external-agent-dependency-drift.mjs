import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const source = fs.readdirSync('src', { recursive: true })
  .filter((entry) => typeof entry === 'string' && /\.(js|jsx|ts|tsx)$/.test(entry))
  .map((entry) => fs.readFileSync(`src/${entry}`, 'utf8'))
  .join('\n');

const failures = [];
const routerVersion = pkg.dependencies?.['react-router-dom'];
if (routerVersion !== '^7.18.4') failures.push(`unexpected react-router-dom version: ${routerVersion}`);
if (pkg.dependencies?.fflate !== '^0.8.3') failures.push(`unexpected fflate version: ${pkg.dependencies?.fflate}`);
if (Object.prototype.hasOwnProperty.call(pkg.dependencies ?? {}, 'react-quill')) failures.push('react-quill remains declared after removal audit');
if (!source.includes('react-router-dom')) failures.push('no react-router-dom source usage found');
if (source.includes("from 'fflate'") || source.includes('from "fflate"')) {
  console.log('fflate source usage detected; retain dependency pending compatibility review.');
} else {
  console.log('fflate has no direct src import; classify as potential dead dependency.');
}
if (source.includes('react-quill')) failures.push('react-quill source usage remains after removal audit');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('External-agent dependency drift audit contract passed.');
