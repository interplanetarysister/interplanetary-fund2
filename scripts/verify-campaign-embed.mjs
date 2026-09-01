import fs from 'node:fs';
import { buildEmbedMarkup } from '../src/components/campaigns/embedMarkup.js';

const componentSource = fs.readFileSync('src/components/campaigns/ShareCampaignKit.jsx', 'utf8');
const utilitySource = fs.readFileSync('src/components/campaigns/embedMarkup.js', 'utf8');

const requiredComponent = [
  'buildEmbedMarkup',
  'navigator.clipboard.writeText',
  'copied === "error"',
  'src={embedUrl}',
  'width="100%"',
  'height="420"',
  'loading="lazy"',
];

for (const pattern of requiredComponent) {
  if (!componentSource.includes(pattern)) {
    throw new Error(`Campaign embed component contract missing: ${pattern}`);
  }
}

if (componentSource.includes('function buildEmbedMarkup') || componentSource.includes('function escapeHtml')) {
  throw new Error('Campaign embed helpers must remain in the testable utility module.');
}

const hostileTitle = '" onload="alert(1) & <script>bad()</script>';
const hostileId = 'campaign-" onclick="alert(1)';
const embedUrl = `https://example.test/embed/campaign/${hostileId}`;
const markup = buildEmbedMarkup({ campaignTitle: hostileTitle, embedUrl });

if (!markup.includes('title="&quot; onload=&quot;alert(1) &amp; &lt;script&gt;bad()&lt;/script&gt; — Interplanetary Fund campaign"')) {
  throw new Error('Hostile campaign titles are not safely escaped in generated iframe attributes.');
}
if (markup.includes('title="" onload="') || markup.includes('<script>')) {
  throw new Error('Generated embed markup permits campaign title attribute breakout.');
}
if (!markup.includes('src="https://example.test/embed/campaign/campaign-&quot; onclick=&quot;alert(1)"')) {
  throw new Error('Campaign-derived embed URL is not safely escaped.');
}
if (!markup.includes('width="100%"') || !markup.includes('max-width:340px') || !markup.includes('min-height:420px')) {
  throw new Error('Generated iframe is not portable/responsive.');
}
if (!markup.includes('loading="lazy"') || !markup.includes('referrerpolicy="strict-origin-when-cross-origin"')) {
  throw new Error('Generated iframe is missing required browser safety/performance attributes.');
}

const canonical = buildEmbedMarkup({
  campaignTitle: 'Community Garden',
  embedUrl: 'https://example.test/embed/campaign/123',
});
if (!canonical.includes('src="https://example.test/embed/campaign/123"')) {
  throw new Error('Canonical campaign embed URL was not preserved.');
}

if (!utilitySource.includes('replace(/&/g, "&amp;")') || !utilitySource.includes('replace(/\\"/g, "&quot;")')) {
  throw new Error('Embed utility must retain HTML attribute escaping.');
}

console.log('Campaign embed behavior verification passed.');
