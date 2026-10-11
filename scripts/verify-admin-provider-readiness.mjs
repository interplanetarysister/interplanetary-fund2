import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const backend = read("base44/functions/adminOAuthProviderReadiness/entry.ts");
const registry = read("base44/shared/connectionVerification.ts");
const frontend = read("src/components/connections/AdminOAuthProviderReadiness.jsx");
const page = read("src/pages/Connections.jsx");

const unique = [...new Set([...registry.matchAll(/^\s*[a-z_]+:\s*'(APP_USER_CONNECTOR_[A-Z_]+)'/gm)].map(x => x[1]))];
// Use the canonical registry, not a stale hard-coded provider count: WordPress
// and future explicitly registered connectors must appear in this same audit.
assert.ok(unique.length >= 25, "Audit must preserve the existing OAuth connector registrations");
assert.ok(unique.includes('APP_USER_CONNECTOR_WORDPRESS_COM_ID'), "Audit must include registered WordPress connector");
assert.match(backend, /assertActiveAccount\(base44\)/, "Admin audit must enforce active account");
assert.match(backend, /guard\.user\?\.role !== 'admin'/, "Only IFund admins may read configuration names");
assert.match(backend, /Object\.entries\(OAUTH_ENV\)/, "Use one canonical OAuth registry");
assert.match(backend, /registration_reference_present/, "Present is only a reference, not a verified connection");
assert.doesNotMatch(backend, /connector_id:|accessToken:|secret_value:/, "Never return connector credentials or provider access tokens");
assert.match(page, /user\?\.role === "admin" && <AdminOAuthProviderReadiness/, "Audit must be admin-only");
assert.match(frontend, /Needs registration/, "Show setup blockers rather than claiming success");
assert.match(frontend, /Reference present; unverified/, "A registration must never be described as connected");
console.log(`PASS: ${unique.length}-provider admin configuration audit and user-account boundary.`);
