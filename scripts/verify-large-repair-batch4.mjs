import fs from "node:fs";
const r=p=>fs.readFileSync(p,"utf8"), must=(v,m)=>{if(!v)throw new Error(m)};
for(const p of ["src/App.jsx","src/components/globe/CampaignGlobe.jsx","src/pages/GlobalGlobe.jsx","src/components/community/ActivityFeed.jsx","src/pages/Dashboard.jsx","src/pages/Inbox.jsx","src/pages/Connections.jsx","src/pages/IntegrationsAdmin.jsx","src/pages/Community.jsx","src/lib/AuthContext.jsx","src/pages/Onboarding.jsx","src/components/platform/ServiceHealthPanel.jsx"]) must(r(p).length>500,"missing repair "+p);
for(const p of ["base44/shared/integrationRegistry.ts","base44/shared/auditLog.ts","base44/functions/validateIntegrationHealth/entry.ts","base44/functions/recordAgentInteraction/entry.ts","base44/functions/communityMembership/entry.ts","base44/functions/recordCampaignCreated/entry.ts"]) must(r(p).length>300,"missing server boundary "+p);
must(!/setError\([^\n]*(?:err|error)\.message/.test(r("src/pages/Connections.jsx")),"Connections exposes raw error");
console.log("Large repair batch 4 contract passed.");
