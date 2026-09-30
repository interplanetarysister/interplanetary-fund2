import fs from "node:fs";
const r=p=>fs.readFileSync(p,"utf8"), must=(v,m)=>{if(!v)throw new Error(m)};
const files=["scripts/verify-large-repair-agent123.mjs","scripts/verify-large-repair-batch2.mjs","scripts/verify-large-repair-batch3.mjs","scripts/verify-large-repair-batch4.mjs","scripts/test-error-boundary-runtime-contract.mjs","scripts/verify-error-boundary-safe-diagnostics.mjs","scripts/test-agent-mail-context-runtime-contract.mjs","scripts/verify-terms-acceptance-contract.mjs"];
for(const p of files) must(r(p).length>100,"missing consolidated verifier "+p);
must(r("src/components/ErrorBoundary.jsx").length>500,"ErrorBoundary repair missing");
must(r("base44/functions/getAgentMailContext/entry.ts").length>300,"agent mail context repair missing");
for (const p of [
  "base44/functions/createDonationCheckout/entry.ts",
  "base44/functions/createSubscriptionCheckout/entry.ts",
  "base44/functions/getMyGiving/entry.ts",
  "base44/functions/geocodeCity/entry.ts",
  "base44/functions/verifyAgentPlatformAccess/entry.ts",
  "base44/functions/getCampaignDonations/entry.ts",
  "base44/functions/broadcastPosts/entry.ts",
  "base44/functions/postDiscussionReply/entry.ts",
  "base44/functions/publishPost/entry.ts",
  "base44/functions/listInstitutionApplications/entry.ts",
  "base44/functions/listConnections/entry.ts",
  "base44/functions/volunteerSignup/entry.ts",
  "base44/functions/syncConnections/entry.ts",
  "src/components/connections/ConnectDialog.jsx",
  "src/pages/Analytics.jsx",
  "src/lib/promptSecurity.js",
  "src/lib/secureLLM.js",
  "src/pages/FollowedCampaigns.jsx"
]) must(r(p).length > 200, "missing legacy consolidation: " + p);
for (const p of [
 "base44/functions/stripeWebhook/entry.ts","base44/functions/updateRecurringDonation/entry.ts","base44/functions/verifyStripeCatalog/entry.ts","base44/shared/subscriptionCatalog.ts","src/components/giving/RecurringPlanCard.jsx",
 "base44/functions/postCampaignUpdate/entry.ts","base44/shared/socialPublish.ts","src/components/dashboard/MissionControl.jsx","src/components/distribution/DistributedPostCard.jsx","src/components/distribution/DistributionPanel.jsx",
 "base44/entities/PlatformEvent.jsonc","base44/functions/recordPlatformEvent/entry.ts","src/components/platform/FeatureFlagsPanel.jsx","src/components/platform/KnowledgePanel.jsx","src/lib/platform/foundationContracts.js","src/pages/Platform.jsx"
]) must(r(p).length > 100, "missing foundational consolidation: " + p);
console.log("Consolidated Agent 1/2/3 repair run contract passed.");
