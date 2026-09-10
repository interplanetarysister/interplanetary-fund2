import fs from "node:fs";

const source = fs.readFileSync("base44/functions/volunteerFollowUp/entry.ts", "utf8");
const required = [
  "const STABLE_DIAGNOSTIC_TYPES = new Set([",
  "console.error('follow-up email failed:', diagnosticType(e));",
  "console.error('volunteerFollowUp error:', diagnosticType(error));",
  "Response.json({ error: 'Unable to send the follow-up. Please try again.' }, { status: 500 })",
];
for (const token of required) {
  if (!source.includes(token)) throw new Error(`Volunteer follow-up safety contract missing: ${token}`);
}
for (const token of ["e.message", "error.message", "JSON.stringify(e)", "JSON.stringify(error)"]) {
  if (source.includes(token)) throw new Error(`Raw exception disclosure remains: ${token}`);
}
console.log("Volunteer follow-up safe diagnostics contract verified");
