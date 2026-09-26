const STATUS_SET = new Set([
  "ACTIVE",
  "REAUTH_REQUIRED",
  "EXPIRES_SOON",
  "DISCONNECTED",
  "REVOKED",
  "MISCONFIGURED",
  "UNKNOWN",
]);

const MAX_ENTRIES = 200;
const MAX_REPORT = 200;
const MAX_LIST = 40;

const FAILURE_BY_STATUS = Object.freeze({
  ACTIVE: "",
  REAUTH_REQUIRED: "Provider authorization needs attention.",
  EXPIRES_SOON: "Provider authorization expires soon.",
  DISCONNECTED: "Live provider verification is unavailable.",
  REVOKED: "Integration access is revoked.",
  MISCONFIGURED: "Required provider configuration is missing.",
  UNKNOWN: "Integration verification status is unknown.",
});

function isPlainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function boundedString(value, max, { allowEmpty = true } = {}) {
  if (typeof value !== "string" || value.length > max) return null;
  const text = value.trim();
  if (!allowEmpty && !text) return null;
  return text;
}

function boundedStringList(value, maxItems = MAX_LIST, maxLength = 128) {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result = [];
  for (const item of value) {
    const text = boundedString(item, maxLength, { allowEmpty: false });
    if (text === null) return null;
    result.push(text);
  }
  return [...new Set(result)];
}

function boundedDate(value) {
  if (value === undefined || value === null || value === "") return "";
  const text = boundedString(value, 64, { allowEmpty: false });
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

export function normalizeIntegrationStatus(value) {
  return STATUS_SET.has(value) ? value : "UNKNOWN";
}

export function safeFailureForStatus(value) {
  return FAILURE_BY_STATUS[normalizeIntegrationStatus(value)];
}

function parseRegistryEntry(entry) {
  if (!isPlainRecord(entry) || Object.keys(entry).length > 40) return null;
  const id = boundedString(entry.id, 128, { allowEmpty: false });
  const platform = boundedString(entry.platform, 64, { allowEmpty: false });
  if (!id || !platform || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(platform)) return null;

  const purpose = boundedString(entry.purpose ?? "", 500);
  const accountIdentifier = boundedString(entry.account_identifier ?? "", 200);
  const adminOwner = boundedString(entry.admin_owner ?? "", 200);
  const reauthInstructions = boundedString(entry.reauth_instructions ?? "", 1000);
  const integrationKind = boundedString(entry.integration_kind ?? "api", 40, { allowEmpty: false });
  const authType = boundedString(entry.auth_type ?? "none", 40, { allowEmpty: false });
  const environment = boundedString(entry.environment ?? "production", 40, { allowEmpty: false });
  const secretRefs = boundedStringList(entry.secret_refs ?? []);
  const agents = boundedStringList(entry.authorized_agents ?? []);
  const dependencies = boundedStringList(entry.dependencies ?? []);
  const flags = boundedStringList(entry.cleanup_flags ?? [], 20, 64);
  const lastVerified = boundedDate(entry.last_verified);
  const lastSuccessful = boundedDate(entry.last_successful_verification);
  const authFailures = entry.auth_failures === undefined
    ? 0
    : Number.isInteger(entry.auth_failures) && entry.auth_failures >= 0 && entry.auth_failures <= 1_000_000
      ? entry.auth_failures
      : null;

  if ([purpose, accountIdentifier, adminOwner, reauthInstructions, integrationKind, authType, environment,
    secretRefs, agents, dependencies, flags, lastVerified, lastSuccessful, authFailures].some((value) => value === null)) {
    return null;
  }

  const status = normalizeIntegrationStatus(entry.status);
  return {
    id,
    platform: platform.toLowerCase(),
    purpose,
    integration_kind: integrationKind,
    account_identifier: accountIdentifier,
    auth_type: authType,
    secret_refs: secretRefs,
    environment,
    authorized_agents: agents,
    dependencies,
    reauth_instructions: reauthInstructions,
    admin_owner: adminOwner,
    status,
    last_verified: lastVerified,
    last_successful_verification: lastSuccessful,
    auth_failures: authFailures,
    cleanup_flags: flags,
    last_failure: safeFailureForStatus(status),
  };
}

export function parseRegistryResponse(value) {
  try {
    if (!Array.isArray(value) || value.length > MAX_ENTRIES) return null;
    const entries = value.map(parseRegistryEntry);
    return entries.every(Boolean) ? entries : null;
  } catch {
    return null;
  }
}

function parseReportRow(row) {
  if (!isPlainRecord(row) || Object.keys(row).length > 8) return null;
  const platform = boundedString(row.platform, 64, { allowEmpty: false });
  if (!platform || !STATUS_SET.has(row.status)) return null;
  const flags = boundedStringList(row.flags ?? [], 20, 64);
  if (!flags || !Array.isArray(row.checks) || row.checks.length > 20) return null;
  const checks = [];
  for (const check of row.checks) {
    if (!isPlainRecord(check) || Object.keys(check).length > 3) return null;
    const name = boundedString(check.check, 64, { allowEmpty: false });
    if (!name || typeof check.ok !== "boolean") return null;
    checks.push({ check: name, ok: check.ok });
  }
  return { platform: platform.toLowerCase(), status: row.status, flags, checks };
}

export function parseHealthResponse(value) {
  try {
    const data = isPlainRecord(value) && isPlainRecord(value.data) ? value.data : value;
    if (!isPlainRecord(data) || Object.keys(data).length > 8 || data.ok !== true) return null;
    if (!Number.isInteger(data.checked) || data.checked < 0 || data.checked > MAX_REPORT) return null;
    if (!Array.isArray(data.report) || data.report.length !== data.checked || data.report.length > MAX_REPORT) return null;
    const at = boundedDate(data.at);
    if (!at) return null;
    const report = data.report.map(parseReportRow);
    return report.every(Boolean) ? { ok: true, checked: data.checked, at, report } : null;
  } catch {
    return null;
  }
}

export function parseManagementResponse(value) {
  try {
    const data = isPlainRecord(value) && isPlainRecord(value.data) ? value.data : value;
    if (!isPlainRecord(data) || Object.keys(data).length > 10 || data.ok !== true) return null;
    const platform = boundedString(data.platform, 64, { allowEmpty: false });
    if (!platform) return null;
    const status = data.status === undefined ? undefined : (STATUS_SET.has(data.status) ? data.status : null);
    if (status === null) return null;
    const agents = data.authorized_agents === undefined ? undefined : boundedStringList(data.authorized_agents);
    if (agents === null) return null;
    return {
      ok: true,
      platform: platform.toLowerCase(),
      ...(status ? { status } : {}),
      ...(agents ? { authorized_agents: agents } : {}),
      verification_required: data.verification_required === true,
    };
  } catch {
    return null;
  }
}

export function parseGitHubResponse(value) {
  try {
    const data = isPlainRecord(value) && isPlainRecord(value.data) ? value.data : value;
    if (!isPlainRecord(data) || Object.keys(data).length > 8 || typeof data.ok !== "boolean") return null;
    if (data.results !== undefined) {
      if (!isPlainRecord(data.results) || Object.keys(data.results).length > 8) return null;
      for (const result of Object.values(data.results)) {
        if (!isPlainRecord(result) || Object.keys(result).length > 5 || typeof result.ok !== "boolean") return null;
      }
    }
    return { ok: data.ok, skipped: data.skipped === true };
  } catch {
    return null;
  }
}

export function boundedWait(promise, timeoutMs = 15_000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Request timed out")), timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

export function createSettlementLock({ timeoutMs = 15_000 } = {}) {
  let pending = null;
  let generation = 0;
  let mounted = true;

  return {
    activate() {
      mounted = true;
    },
    invalidate() {
      mounted = false;
      generation += 1;
    },
    start(operation) {
      if (pending) return null;
      const token = ++generation;
      const source = Promise.resolve().then(operation);
      pending = source;
      source.then(
        () => { if (pending === source) pending = null; },
        () => { if (pending === source) pending = null; },
      );
      return {
        token,
        visible: boundedWait(source, timeoutMs),
        settled: source,
        isCurrent: () => mounted && generation === token,
      };
    },
    isLocked() {
      return pending !== null;
    },
  };
}
