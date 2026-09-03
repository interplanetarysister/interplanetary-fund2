import fs from "node:fs";

const feeSource = fs.readFileSync("base44/shared/fees.js", "utf8");
const withdrawalSource = fs.readFileSync("base44/functions/requestWithdrawal/entry.ts", "utf8");
const verifierSource = fs.readFileSync("scripts/verify-fraud-approval-workflow.mjs", "utf8");

const feeMatch = feeSource.match(/PLATFORM_FEE_RATE\s*=\s*(0\.\d+)/);
if (!feeMatch) throw new Error("Unable to locate PLATFORM_FEE_RATE in base44/shared/fees.js");
const canonicalRate = Number(feeMatch[1]);

const claimedRates = [
  ...withdrawalSource.matchAll(/(?:FEE_RATE|PLATFORM_FEE_RATE|feeRate)\s*[:=]\s*(0\.\d+)/g),
  ...verifierSource.matchAll(/(?:FEE_RATE|PLATFORM_FEE_RATE|feeRate)\s*[:=]\s*(0\.\d+)/g),
].map((match) => Number(match[1]));

const distinctClaimedRates = [...new Set(claimedRates)];
if (distinctClaimedRates.some((rate) => rate !== canonicalRate)) {
  throw new Error(
    `Financial contract mismatch: canonical PLATFORM_FEE_RATE=${canonicalRate}; ` +
      `workflow/verifier claims=${distinctClaimedRates.join(", ") || "none"}`,
  );
}

console.log(`Financial contract consistent at rate ${canonicalRate}`);
