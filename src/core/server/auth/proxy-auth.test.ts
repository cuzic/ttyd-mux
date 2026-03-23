import { describe, expect, it } from 'bun:test';
import { extractProxyUser, isTrustedProxy, type ProxyAuthOptions } from './proxy-auth.js';

// === isTrustedProxy ===

describe('isTrustedProxy', () => {
  it('returns true for exact IP match', () => {
    expect(isTrustedProxy('192.168.1.1', ['192.168.1.1'])).toBe(true);
  });

  it('returns true when IP matches one of multiple trusted proxies', () => {
    expect(isTrustedProxy('10.0.0.1', ['192.168.1.1', '10.0.0.1'])).toBe(true);
  });

  it('returns false when IP does not match any trusted proxy', () => {
    expect(isTrustedProxy('203.0.113.50', ['192.168.1.1', '10.0.0.1'])).toBe(false);
  });

  it('returns false for empty trusted proxy list', () => {
    expect(isTrustedProxy('192.168.1.1', [])).toBe(false);
  });

  it('returns true for CIDR match (IPv4)', () => {
    expect(isTrustedProxy('10.0.0.5', ['10.0.0.0/24'])).toBe(true);
  });

  it('returns false for CIDR non-match (IPv4)', () => {
    expect(isTrustedProxy('10.0.1.5', ['10.0.0.0/24'])).toBe(false);
  });

  it('returns true for /16 CIDR match', () => {
    expect(isTrustedProxy('172.16.5.10', ['172.16.0.0/16'])).toBe(true);
  });

  it('returns false for /16 CIDR non-match', () => {
    expect(isTrustedProxy('172.17.0.1', ['172.16.0.0/16'])).toBe(false);
  });

  it('handles mixed exact IPs and CIDRs', () => {
    const trusted = ['192.168.1.1', '10.0.0.0/8'];
    expect(isTrustedProxy('192.168.1.1', trusted)).toBe(true);
    expect(isTrustedProxy('10.255.0.1', trusted)).toBe(true);
    expect(isTrustedProxy('172.16.0.1', trusted)).toBe(false);
  });

  it('returns true for IPv6 exact match', () => {
    expect(isTrustedProxy('::1', ['::1'])).toBe(true);
  });

  it('returns true for IPv6 CIDR match', () => {
    expect(isTrustedProxy('fd00::1', ['fd00::/8'])).toBe(true);
  });

  it('returns false for IPv6 CIDR non-match', () => {
    expect(isTrustedProxy('fe80::1', ['fd00::/8'])).toBe(false);
  });
});

// === extractProxyUser ===

describe('extractProxyUser', () => {
  function makeRequest(url: string, headers: Record<string, string> = {}): Request {
    return new Request(url, { headers });
  }

  const defaultOptions: ProxyAuthOptions = {
    trustedProxies: ['192.168.1.1'],
    proxyHeader: 'X-Forwarded-User'
  };

  it('returns header value when request is from trusted proxy', () => {
    const req = makeRequest('http://192.168.1.1:7680/bunterm', {
      'X-Forwarded-User': 'alice'
    });
    expect(extractProxyUser(req, '192.168.1.1', defaultOptions)).toBe('alice');
  });

  it('returns null when request is from untrusted proxy', () => {
    const req = makeRequest('http://203.0.113.50:7680/bunterm', {
      'X-Forwarded-User': 'alice'
    });
    expect(extractProxyUser(req, '203.0.113.50', defaultOptions)).toBeNull();
  });

  it('returns null when header is missing (trusted proxy)', () => {
    const req = makeRequest('http://192.168.1.1:7680/bunterm');
    expect(extractProxyUser(req, '192.168.1.1', defaultOptions)).toBeNull();
  });

  it('returns null when header is empty string', () => {
    const req = makeRequest('http://192.168.1.1:7680/bunterm', {
      'X-Forwarded-User': ''
    });
    expect(extractProxyUser(req, '192.168.1.1', defaultOptions)).toBeNull();
  });

  it('uses custom header name', () => {
    const options: ProxyAuthOptions = {
      trustedProxies: ['10.0.0.1'],
      proxyHeader: 'X-Remote-User'
    };
    const req = makeRequest('http://10.0.0.1:7680/bunterm', {
      'X-Remote-User': 'bob'
    });
    expect(extractProxyUser(req, '10.0.0.1', options)).toBe('bob');
  });

  it('returns null when trusted proxies list is empty', () => {
    const options: ProxyAuthOptions = {
      trustedProxies: [],
      proxyHeader: 'X-Forwarded-User'
    };
    const req = makeRequest('http://192.168.1.1:7680/bunterm', {
      'X-Forwarded-User': 'alice'
    });
    expect(extractProxyUser(req, '192.168.1.1', options)).toBeNull();
  });

  it('works with CIDR-based trusted proxy', () => {
    const options: ProxyAuthOptions = {
      trustedProxies: ['10.0.0.0/8'],
      proxyHeader: 'X-Forwarded-User'
    };
    const req = makeRequest('http://10.1.2.3:7680/bunterm', {
      'X-Forwarded-User': 'charlie'
    });
    expect(extractProxyUser(req, '10.1.2.3', options)).toBe('charlie');
  });
});
