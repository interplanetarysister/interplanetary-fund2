import fs from "node:fs";

const register = fs.readFileSync("src/pages/Register.jsx","utf8");
const catalog = fs.readFileSync("src/components/connections/platformCatalog.js","utf8");
const recipes = fs.readFileSync("base44/lib/platformConnectionRecipes.ts","utf8");
const wix = fs.readFileSync("base44/functions/syncWixMissionControl/entry.ts","utf8");

const must = (ok,msg) => { if(!ok) throw new Error(msg); };
must(register.includes("Passwords do not match."), "registration mismatch repair missing");
must(register.includes("email: cleanEmail"), "normalized registration email missing");
must(wix.includes("interplanetaryfund.com/Campaign"), "canonical Wix campaign URL missing");
must(!wix.includes("detail: text((error"), "raw Wix error detail exposed");
must(wix.includes("PUBLIC_CAMPAIGN_STATUSES"), "explicit Wix public status allowlist missing");
for (const id of ["threads","x","pinterest","reddit","youtube"]) {
  const start = catalog.indexOf(`id: "${id}"`);
  if (start >= 0) {
    const block = catalog.slice(start, start + 900);
    must(!block.includes('setupKind: "oauth"'), `${id} still claims unsupported OAuth`);
  }
}
must(!recipes.includes("connector_type: 'patreon'"), "Patreon still claims unverified native connector");
console.log("Large Agent 1/2/3 repair contract passed.");
