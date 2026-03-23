import { describe, expect, it } from 'bun:test';
import { classifyNetwork, isPrivateIP } from './network-classifier.js';

describe('classifyNetwork', () => {
  describe('localhost detection', () => {
    it('classifies 127.0.0.1 as localhost', () => {
      expect(classifyNetwork('127.0.0.1')).toBe('localhost');
    });

    it('classifies ::1 as localhost', () => {
      expect(classifyNetwork('::1')).toBe('localhost');
    });

    it('classifies 127.0.0.2 as localhost (loopback range)', () => {
      expect(classifyNetwork('127.0.0.2')).toBe('localhost');
    });

    it('classifies 127.255.255.255 as localhost', () => {
      expect(classifyNetwork('127.255.255.255')).toBe('localhost');
    });
  });

  describe('LAN (private IP) detection', () => {
    it('classifies 10.0.0.1 as lan', () => {
      expect(classifyNetwork('10.0.0.1')).toBe('lan');
    });

    it('classifies 10.255.255.255 as lan', () => {
      expect(classifyNetwork('10.255.255.255')).toBe('lan');
    });

    it('classifies 172.16.0.1 as lan', () => {
      expect(classifyNetwork('172.16.0.1')).toBe('lan');
    });

    it('classifies 172.31.255.255 as lan', () => {
      expect(classifyNetwork('172.31.255.255')).toBe('lan');
    });

    it('classifies 192.168.1.1 as lan', () => {
      expect(classifyNetwork('192.168.1.1')).toBe('lan');
    });

    it('classifies 192.168.255.255 as lan', () => {
      expect(classifyNetwork('192.168.255.255')).toBe('lan');
    });

    it('classifies fd00::1 as lan (IPv6 ULA)', () => {
      expect(classifyNetwork('fd00::1')).toBe('lan');
    });

    it('classifies fc00::1 as lan (IPv6 ULA)', () => {
      expect(classifyNetwork('fc00::1')).toBe('lan');
    });

    it('classifies 169.254.1.1 as lan (link-local)', () => {
      expect(classifyNetwork('169.254.1.1')).toBe('lan');
    });

    it('classifies fe80::1 as lan (IPv6 link-local)', () => {
      expect(classifyNetwork('fe80::1')).toBe('lan');
    });
  });

  describe('Internet (public IP) detection', () => {
    it('classifies 8.8.8.8 as internet', () => {
      expect(classifyNetwork('8.8.8.8')).toBe('internet');
    });

    it('classifies 1.1.1.1 as internet', () => {
      expect(classifyNetwork('1.1.1.1')).toBe('internet');
    });

    it('classifies 2001:db8::1 as internet', () => {
      expect(classifyNetwork('2001:db8::1')).toBe('internet');
    });

    it('classifies 203.0.113.1 as internet', () => {
      expect(classifyNetwork('203.0.113.1')).toBe('internet');
    });

    it('does not classify 172.32.0.1 as lan (outside 172.16-31 range)', () => {
      expect(classifyNetwork('172.32.0.1')).toBe('internet');
    });

    it('does not classify 172.15.255.255 as lan', () => {
      expect(classifyNetwork('172.15.255.255')).toBe('internet');
    });
  });

  describe('edge cases', () => {
    it('classifies empty string as internet', () => {
      expect(classifyNetwork('')).toBe('internet');
    });

    it('classifies malformed IP as internet', () => {
      expect(classifyNetwork('not-an-ip')).toBe('internet');
    });

    it('classifies 0.0.0.0 as internet', () => {
      expect(classifyNetwork('0.0.0.0')).toBe('internet');
    });
  });
});

describe('isPrivateIP', () => {
  it('returns true for RFC 1918 addresses', () => {
    expect(isPrivateIP('10.0.0.1')).toBe(true);
    expect(isPrivateIP('172.16.0.1')).toBe(true);
    expect(isPrivateIP('192.168.1.1')).toBe(true);
  });

  it('returns true for RFC 4193 addresses (IPv6 ULA)', () => {
    expect(isPrivateIP('fd00::1')).toBe(true);
    expect(isPrivateIP('fc00::1')).toBe(true);
  });

  it('returns false for public addresses', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false);
    expect(isPrivateIP('2001:db8::1')).toBe(false);
  });

  it('returns false for loopback (loopback is not "private" in this context)', () => {
    expect(isPrivateIP('127.0.0.1')).toBe(false);
    expect(isPrivateIP('::1')).toBe(false);
  });
});
