import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const errors = [];

if (pkg.dependencies?.['react-router-dom'] !== '^7.18.4') errors.push('Expected react-router-dom ^7.18.4');

const requiredFiles = [
  'src/hooks/useUrlDialog.js',
  'src/hooks/useSwipeBack.js',
  'src/components/ProtectedRoute.jsx',
  'src/components/ScrollToTop.jsx',
];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`Missing router/mobile contract file: ${file}`);
}

const source = requiredFiles
  .filter((file) => fs.existsSync(path.join(root, file)))
  .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');

for (const token of ['useSearchParams', 'useNavigate', 'useLocation', 'useNavigationType', 'Outlet']) {
  if (!source.includes(token)) errors.push(`Expected router API usage not found: ${token}`);
}
if (!source.includes('navigate(-1)') && !source.includes('history.back')) {
  errors.push('No explicit back-navigation contract found in mobile helpers');
}
if (/from\s+["']react-router["']/.test(source)) {
  errors.push('Unexpected direct import from react-router; use react-router-dom in app code');
}

if (errors.length) {
  console.error('React Router 7 mobile compatibility verifier failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('React Router 7 mobile compatibility source contract passed.');
