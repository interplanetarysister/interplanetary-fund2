import assert from "node:assert/strict";
import { buildEmbedMarkup, escapeHtml } from "../src/components/campaigns/embedMarkup.js";

const hostileTitle = 'Campaign \" onload=\"alert(1)\" <script>alert(2)</script>';
const hostileId = 'campaign\" onload=\"alert(3)\"/../other';
const origin = "https://example.test";
const encodedId = encodeURIComponent(hostileId);
const embedUrl = `${origin}/embed/campaign/${encodedId}`;
const markup = buildEmbedMarkup({ campaignTitle: hostileTitle, embedUrl });

assert.match(markup, /src=\"https:\/\/example\.test\/embed\/campaign\//);
assert.match(markup, /title=\"Campaign &quot; onload=&quot;alert\(1\)&quot; &lt;script&gt;alert\(2\)&lt;\/script&gt; — Interplanetary Fund campaign\"/);
assert.doesNotMatch(markup, /onload=\"alert\(1\)/);
assert.doesNotMatch(markup, /<script>/);
assert.doesNotMatch(markup, /&lt;script&gt;.*onload/);
assert.match(markup, /width=\"100%\"/);
assert.match(markup, /max-width:340px/);
assert.match(markup, /min-height:420px/);
assert.match(markup, /referrerpolicy=\"strict-origin-when-cross-origin\"/);

const escapedUrl = escapeHtml(`${origin}/embed/campaign/${hostileId}`);
assert.match(escapedUrl, /&quot;/);
assert.doesNotMatch(escapedUrl, /onload=\"alert\(3\)/);

console.log("Campaign embed behavior verification passed.");
