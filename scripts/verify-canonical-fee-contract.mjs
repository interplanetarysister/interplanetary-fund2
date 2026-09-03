import assert from "node:assert/strict";
import fs from "node:fs/promises";

const withdrawal = await fs.readFile(new URL("../base44/functions/requestWithdrawal/entry.ts", import.meta.url), "utf8");
assert.match(withdrawal, /const PLATFORM_FEE_RATE\s*=\s*0\.07/);
assert.match(withdrawal, /const fee = round2\(gross \* PLATFORM_FEE_RATE\)/);
assert.match(withdrawal, /const net = round2\(gross - fee\)/);
console.log("Canonical 7% platform fee contract verified.");
