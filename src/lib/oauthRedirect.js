const APPROVED_NATIVE_PROTOCOLS = new Set(['cursor:', 'vscode:', 'vscode-insiders:']);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function trustedOAuthRedirect(value, origin = globalThis.location?.origin || '') {
  if (typeof value !== 'string' || !value.trim() || !origin) return null;
  let target;
  try {
    target = new URL(value.trim(), origin);
  } catch {
    return null;
  }
  if (target.username || target.password) return null;
  if (target.protocol === 'https:') return { url: target.href, browser: true };
  if (target.protocol === 'http:' && LOOPBACK_HOSTS.has(target.hostname)) {
    return { url: target.href, browser: true };
  }
  if (APPROVED_NATIVE_PROTOCOLS.has(target.protocol)) {
    return { url: target.href, browser: false };
  }
  return null;
}
