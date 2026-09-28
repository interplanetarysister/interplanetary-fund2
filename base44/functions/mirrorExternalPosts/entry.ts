import { runExternalMirroring } from '../../shared/externalMirroringPolicy.js';

// External feed mirroring is intentionally fail-closed. The former worker
// used one app-wide Discord connector and attributed that shared dataset to
// every user's connection. Until Base44 exposes a proven per-owner connector
// binding and invocation identity for this scheduled job, no provider read or
// SocialPost write is permitted.
export default async function(req) {
  void req;
  const report = await runExternalMirroring();
  return Response.json(report);
}
