import assert from "node:assert/strict";
import { buildSocialShareTargets } from "../src/lib/socialShareTargets.js";
import { campaignPublicUrl } from "../src/lib/campaignSharing.js";

const campaignUrl = campaignPublicUrl("campaign_42");
const sharing = buildSocialShareTargets({
  url: campaignUrl,
  title: 'Help Sam & family #1',
  image: "https://cdn.example.com/photo.jpg?a=1&b=2",
});
const byName = Object.fromEntries(sharing.map(item => [item.id, item]));

assert.equal(sharing.length, 12, "Expected eleven share destinations plus Pinterest when cover is available");
assert.equal(byName.facebook.href.startsWith("https://www.facebook.com/"), true);
assert.equal(new URL(byName.facebook.href).searchParams.get("u"), campaignUrl);
assert.equal(new URL(byName.x.href).searchParams.get("url"), campaignUrl);
assert.match(new URL(byName.x.href).searchParams.get("text"), /Sam & family/);
assert.equal(new URL(byName.linkedin.href).searchParams.get("url"), campaignUrl);
assert.equal(new URL(byName.reddit.href).searchParams.get("url"), campaignUrl);
assert.ok(new URL(byName.whatsapp.href).searchParams.get("text").includes(campaignUrl));
assert.equal(new URL(byName.telegram.href).searchParams.get("url"), campaignUrl);
assert.ok(new URL(byName.bluesky.href).searchParams.get("text").includes(campaignUrl));
assert.equal(new URL(byName.tumblr.href).searchParams.get("canonicalUrl"), campaignUrl);
assert.ok(new URL(byName.threads.href).searchParams.get("text").includes(campaignUrl));
assert.equal(new URL(byName.pinterest.href).searchParams.get("media"), "https://cdn.example.com/photo.jpg?a=1&b=2");
assert.equal(byName.email.href.startsWith("mailto:"), true);
assert.ok(byName.sms.href.includes(encodeURIComponent(campaignUrl)));
assert.ok(sharing.every(item => item.external === false || item.href.startsWith("https://")));

const noImage = buildSocialShareTargets({ url: campaignUrl, title: "Campaign" });
assert.equal(noImage.length, 11, "Pinterest is omitted when there is no image");
assert.ok(!noImage.find(item => item.id === "pinterest"));
assert.deepEqual(buildSocialShareTargets({ url: "https://wrong.example/campaign/id" }), []);
assert.deepEqual(buildSocialShareTargets({ url: "https://interplanetaryfund.com/campaign/id?token=private" }), []);
assert.deepEqual(buildSocialShareTargets({ url: "javascript:alert(1)" }), []);
assert.deepEqual(buildSocialShareTargets({ url: "https://interplanetaryfund.com/other" }), []);
assert.equal(campaignPublicUrl("../untrusted"), "");

console.log("Campaign social share destinations: PASS");
