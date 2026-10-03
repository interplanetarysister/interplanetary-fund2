const PROVIDER_HOSTS = {
  gofundme: ['gofundme.com'], kickstarter: ['kickstarter.com'], indiegogo: ['indiegogo.com'],
  fundrazr: ['fundrazr.com'], givesendgo: ['givesendgo.com'], kofi: ['ko-fi.com'],
  buymeacoffee: ['buymeacoffee.com'], patreon: ['patreon.com'], spotfund: ['spotfund.com'],
  eventbrite: ['eventbrite.com'],
};

export function hostAllowed(platform, host) {
  const normalized = String(host || '').toLowerCase().replace(/\.$/, '');
  return (PROVIDER_HOSTS[String(platform || '').toLowerCase()] || [])
    .some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
}

function ipv4Number(address) {
  const parts = String(address).split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0;
}

function inIpv4Range(value, start, prefix) {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (ipv4Number(start) & mask);
}

function isNonPublicIpv4(address) {
  const value = ipv4Number(address);
  if (value === null) return true;
  return [
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
    ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
    ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
    ['224.0.0.0', 4], ['240.0.0.0', 4],
  ].some(([start, prefix]) => inIpv4Range(value, start, prefix));
}

function isNonPublicIpv6(address) {
  const normalized = String(address).toLowerCase().split('%')[0];
  if (normalized.startsWith('::ffff:')) return isNonPublicIpv4(normalized.slice(7));
  return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') ||
    normalized.startsWith('fd') || /^fe[89ab]/.test(normalized) || normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8:');
}

export function isPrivateAddress(address) {
  return String(address).includes(':') ? isNonPublicIpv6(address) : isNonPublicIpv4(address);
}

// Base44's function fetch API does not expose DNS pinning/private-egress
// controls. Resolving a hostname and then making a separate hostname request is vulnerable
// to DNS rebinding between validation and connection, so public-page discovery
// stays unavailable until a provider API/connector or pinned transport exists.
export async function discoverProviderCampaign() {
  throw new Error('provider_discovery_transport_unavailable');
}
