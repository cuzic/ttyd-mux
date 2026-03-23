/**
 * Network Classifier — Adaptive Shield
 *
 * Classifies remote addresses into network zones:
 * - localhost: loopback addresses (127.0.0.0/8, ::1)
 * - lan: private/link-local addresses (RFC 1918, RFC 4193, link-local)
 * - internet: everything else
 */

export type NetworkZone = 'localhost' | 'lan' | 'internet';

// === IPv4 Helpers ===

function parseIPv4(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return nums;
}

function isLoopbackV4(octets: number[]): boolean {
  return octets[0] === 127;
}

function isPrivateV4(octets: number[]): boolean {
  const [a, b] = octets as [number, number, number, number];
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;
  return false;
}

// === IPv6 Helpers ===

function expandIPv6(ip: string): string | null {
  // Strip brackets if present
  const cleaned = ip.replace(/^\[|\]$/g, '');
  const parts = cleaned.split(':');
  const emptyIndex = parts.indexOf('');

  if (emptyIndex !== -1) {
    const before = parts.slice(0, emptyIndex).filter(Boolean);
    const after = parts.slice(emptyIndex + 1).filter(Boolean);
    const missing = 8 - before.length - after.length;
    if (missing < 0) return null;
    const expanded = [...before, ...Array(missing).fill('0'), ...after];
    return expanded.map((p) => p.padStart(4, '0')).join(':');
  }

  if (parts.length !== 8) return null;
  return parts.map((p) => p.padStart(4, '0')).join(':');
}

function isLoopbackV6(ip: string): boolean {
  const expanded = expandIPv6(ip);
  return expanded === '0000:0000:0000:0000:0000:0000:0000:0001';
}

function isPrivateV6(ip: string): boolean {
  const expanded = expandIPv6(ip);
  if (!expanded) return false;
  const firstGroup = expanded.slice(0, 4);
  const firstByte = Number.parseInt(firstGroup, 16);
  // fc00::/7 — ULA (fc00::/8 + fd00::/8)
  if ((firstByte & 0xfe00) === 0xfc00) return true;
  // fe80::/10 — link-local
  if ((firstByte & 0xffc0) === 0xfe80) return true;
  return false;
}

// === Public API ===

/**
 * Classify a remote address into a network zone.
 * - 127.0.0.0/8, ::1 → 'localhost'
 * - RFC 1918, RFC 4193, link-local → 'lan'
 * - Everything else → 'internet'
 */
export function classifyNetwork(remoteAddr: string): NetworkZone {
  if (!remoteAddr) return 'internet';

  // Try IPv4
  const octets = parseIPv4(remoteAddr);
  if (octets) {
    if (isLoopbackV4(octets)) return 'localhost';
    if (isPrivateV4(octets)) return 'lan';
    return 'internet';
  }

  // Try IPv6
  if (remoteAddr.includes(':')) {
    if (isLoopbackV6(remoteAddr)) return 'localhost';
    if (isPrivateV6(remoteAddr)) return 'lan';
    return 'internet';
  }

  return 'internet';
}

/**
 * Check if an IP is a private/LAN address (RFC 1918 + RFC 4193 + link-local).
 * Does NOT include loopback — use classifyNetwork for full classification.
 */
export function isPrivateIP(ip: string): boolean {
  const octets = parseIPv4(ip);
  if (octets) return isPrivateV4(octets);
  if (ip.includes(':')) return isPrivateV6(ip);
  return false;
}
