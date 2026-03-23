/**
 * Proxy Authentication
 *
 * Trusts X-Forwarded-User (or configurable header) from reverse proxies
 * whose IP is in the trusted proxy list. Supports exact IP and CIDR notation.
 */

// === Types ===

export interface ProxyAuthOptions {
  /** Trusted proxy IPs or CIDRs (e.g. ["192.168.1.1", "10.0.0.0/8"]) */
  trustedProxies: string[];
  /** Header name containing the authenticated user (default: X-Forwarded-User) */
  proxyHeader: string;
}

// === CIDR Matching ===

function ipToNumber(ip: string): number {
  const parts = ip.split('.');
  return (
    ((Number(parts[0]) << 24) |
      (Number(parts[1]) << 16) |
      (Number(parts[2]) << 8) |
      Number(parts[3])) >>>
    0
  ); // unsigned 32-bit
}

function isIPv4(ip: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);
}

/**
 * Expand an IPv6 address to its full 8-group form.
 * e.g. "fd00::1" → "fd00:0000:0000:0000:0000:0000:0000:0001"
 */
function expandIPv6(ip: string): string {
  const parts = ip.split(':');
  const emptyIndex = parts.indexOf('');

  if (emptyIndex !== -1) {
    // Handle :: expansion
    const before = parts.slice(0, emptyIndex).filter(Boolean);
    const after = parts.slice(emptyIndex + 1).filter(Boolean);
    // Also handle leading :: or trailing ::
    const missing = 8 - before.length - after.length;
    const expanded = [...before, ...Array(missing).fill('0'), ...after];
    return expanded.map((p) => p.padStart(4, '0')).join(':');
  }

  return parts.map((p) => p.padStart(4, '0')).join(':');
}

/**
 * Convert an IPv6 address string to a BigInt for numeric comparison.
 */
function ipv6ToBigInt(ip: string): bigint {
  const full = expandIPv6(ip);
  const groups = full.split(':');
  let result = 0n;
  for (const group of groups) {
    result = (result << 16n) | BigInt(Number.parseInt(group, 16));
  }
  return result;
}

function matchesCIDR(ip: string, cidr: string): boolean {
  const parts = cidr.split('/');
  const network = parts[0] as string;
  const prefix = Number(parts[1]);

  // IPv4
  if (isIPv4(ip) && isIPv4(network)) {
    const ipNum = ipToNumber(ip);
    const networkNum = ipToNumber(network);
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipNum & mask) === (networkNum & mask);
  }

  // IPv6
  if (!isIPv4(ip) && !isIPv4(network)) {
    const ipNum = ipv6ToBigInt(ip);
    const networkNum = ipv6ToBigInt(network);
    const shift = BigInt(128 - prefix);
    return ipNum >> shift === networkNum >> shift;
  }

  return false;
}

// === Public API ===

/**
 * Check if a remote address is in the trusted proxy list.
 * Supports exact IP match and CIDR notation.
 */
export function isTrustedProxy(remoteAddr: string, trustedProxies: string[]): boolean {
  for (const entry of trustedProxies) {
    if (entry.includes('/')) {
      if (matchesCIDR(remoteAddr, entry)) {
        return true;
      }
    } else if (remoteAddr === entry) {
      return true;
    }
  }
  return false;
}

/**
 * Extract the proxy-authenticated user from the request.
 * Returns the header value only if the request comes from a trusted proxy.
 * Returns null if untrusted, header missing, or header empty.
 */
export function extractProxyUser(
  req: Request,
  remoteAddr: string,
  options: ProxyAuthOptions
): string | null {
  if (!isTrustedProxy(remoteAddr, options.trustedProxies)) {
    return null;
  }

  const value = req.headers.get(options.proxyHeader);
  if (!value) {
    return null;
  }

  return value;
}
