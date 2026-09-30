import fs from "node:fs";
const r=p=>fs.readFileSync(p,"utf8"), must=(v,m)=>{if(!v)throw new Error(m)};
const files=["scripts/verify-large-repair-agent123.mjs","scripts/verify-large-repair-batch2.mjs","scripts/verify-large-repair-batch3.mjs","scripts/verify-large-repair-batch4.mjs","scripts/test-error-boundary-runtime-contract.mjs","scripts/verify-error-boundary-safe-diagnostics.mjs","scripts/test-agent-mail-context-runtime-contract.mjs","scripts/verify-terms-acceptance-contract.mjs"];
for(const p of files) must(r(p).length>100,"missing consolidated verifier "+p);
must(r("src/components/ErrorBoundary.jsx").length>500,"ErrorBoundary repair missing");
must(r("base44/functions/getAgentMailContext/entry.ts").length>300,"agent mail context repair missing");
console.log("Consolidated Agent 1/2/3 repair run contract passed.");
