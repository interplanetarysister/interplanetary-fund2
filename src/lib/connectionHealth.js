const STALE_MS = 7 * 24 * 60 * 60 * 1000;

export function connectionHealth(connection, now = Date.now()) {
  if (!connection || connection.status === "disconnected") {
    return { key: "disconnected", label: "Connect", usable: false, needsAttention: false };
  }

  const lastSync = connection.last_synced ? new Date(connection.last_synced).getTime() : 0;
  const stale = !!lastSync && Number.isFinite(lastSync) && now - lastSync > STALE_MS;
  const hasError = connection.status === "error" || !!connection.last_error;
  const verified = connection.status === "connected" && connection.verification_status === "verified";

  if (hasError || stale || !verified) {
    return {
      key: "needs_attention",
      label: "Needs attention",
      usable: false,
      needsAttention: true,
      reason: connection.last_error || (stale ? "Connection has not been verified recently." : "Connection is not verified."),
    };
  }

  return { key: "connected", label: "Connected", usable: true, needsAttention: false };
}

export function isUsableConnection(connection) {
  return connectionHealth(connection).usable;
}
