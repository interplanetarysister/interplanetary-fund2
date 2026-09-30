import fs from "node:fs";
const read=p=>fs.readFileSync(p,"utf8"); const must=(v,m)=>{if(!v)throw new Error(m)};
must(read("src/components/Layout.jsx").length>1000,"layout navigation repair missing");
for(const p of ["scripts/verify-notification-navigation.mjs","scripts/verify-text-contrast-contract.mjs","scripts/test-text-contrast-contract.mjs","scripts/audit-dependency-router-drift.mjs","scripts/test-audit-dependency-router-drift.mjs","scripts/verify-social-current-main-boundary-run11.mjs","scripts/verify-rate-limit-safe-diagnostics.mjs","scripts/verify-activity-event-safe-diagnostics-run11.mjs","scripts/verify-socialpost-external-identity.mjs"]) must(read(p).length>100,"missing repair verifier: "+p);
console.log("Large repair batch 3 contract passed.");
