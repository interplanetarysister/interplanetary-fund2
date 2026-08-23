import { readFile } from "node:fs/promises";

const termsSource = await readFile(new URL("../src/components/TermsAcceptance.jsx", import.meta.url), "utf8");

const forbiddenFragments = [
  "$50",
  "per claim",
  "Michelle Rogers is not liable",
  "personally liable for losses",
  "personal liability for losses",
];

for (const fragment of forbiddenFragments) {
  if (termsSource.toLowerCase().includes(fragment.toLowerCase())) {
    throw new Error(`Opening agreement still contains prohibited personal-liability wording: ${fragment}`);
  }
}

for (const required of [
  "Campaign outcomes, donations, and third-party services may involve risks.",
  "Users are responsible for the campaigns, content, and actions they initiate through the platform.",
  "I Agree — Continue",
]) {
  if (!termsSource.includes(required)) {
    throw new Error(`Opening agreement is missing required corrected content: ${required}`);
  }
}

console.log("Opening agreement liability verification passed.");
