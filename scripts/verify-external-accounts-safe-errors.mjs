import { readFile } from "node:fs/promises";

const source = await readFile("src/pages/ExternalAccounts.jsx", "utf8");

const required = [
  'catch {',
  'setError("Couldn\'t load external accounts. Please retry.")',
  'if (me.role !== "admin") return;',
  'onRetry={() => { setError(null); setConnections(null); setPosts(null); setRefreshKey((k) => k + 1); }}',
];

for (const fragment of required) {
  if (!source.includes(fragment)) {
    throw new Error(`Missing ExternalAccounts safety contract: ${fragment}`);
  }
}

for (const forbidden of [
  'catch (e)',
  'e.message',
  'error.message',
  'JSON.stringify(e)',
]) {
  if (source.includes(forbidden)) {
    throw new Error(`Forbidden raw error disclosure remains: ${forbidden}`);
  }
}

console.log("ExternalAccounts safe-error contract passed");
