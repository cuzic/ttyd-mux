import { describe, expect, it } from 'bun:test';
import {
  Osc633Parser,
  parseExitCode,
  parseProperty,
  unescapeOsc633Command
} from './osc633-parser.js';

describe('Osc633Parser', () => {
  describe('parse', () => {
    it('should pass through text without OSC sequences', () => {
      const parser = new Osc633Parser();
      const result = parser.parse('Hello, World!');

      expect(result.filteredOutput).toBe('Hello, World!');
      expect(result.sequences).toHaveLength(0);
    });

    it('should parse and filter OSC 633 A sequence (prompt start)', () => {
      const parser = new Osc633Parser();
      const result = parser.parse('\x1b]633;A\x07user@host:~$ ');

      expect(result.filteredOutput).toBe('user@host:~$ ');
      expect(result.sequences).toHaveLength(1);
      expect(result.sequences[0]).toEqual({ type: 'A', data: undefined });
    });

    it('should parse OSC 633 B sequence (prompt end)', () => {
      const parser = new Osc633Parser();
      const result = parser.parse('$ \x1b]633;B\x07');

      expect(result.filteredOutput).toBe('$ ');
      expect(result.sequences).toHaveLength(1);
      expect(result.sequences[0]).toEqual({ type: 'B', data: undefined });
    });

    it('should parse OSC 633 C sequence (pre-execution)', () => {
      const parser = new Osc633Parser();
      const result = parser.parse('\x1b]633;C\x07');

      expect(result.filteredOutput).toBe('');
      expect(result.sequences).toHaveLength(1);
      expect(result.sequences[0]).toEqual({ type: 'C', data: undefined });
    });

    it('should parse OSC 633 D sequence with exit code', () => {
      const parser = new Osc633Parser();
      const result = parser.parse('\x1b]633;D;0\x07');

      expect(result.filteredOutput).toBe('');
      expect(result.sequences).toHaveLength(1);
      expect(result.sequences[0]).toEqual({ type: 'D', data: '0' });
    });

    it('should parse OSC 633 D sequence with non-zero exit code', () => {
      const parser = new Osc633Parser();
      const result = parser.parse('\x1b]633;D;127\x07');

      expect(result.sequences).toHaveLength(1);
      expect(result.sequences[0]).toEqual({ type: 'D', data: '127' });
    });

    it('should parse OSC 633 E sequence with escaped command', () => {
      const parser = new Osc633Parser();
      const result = parser.parse('\x1b]633;E;echo hello\x07');

      expect(result.filteredOutput).toBe('');
      expect(result.sequences).toHaveLength(1);
      expect(result.sequences[0]).toEqual({ type: 'E', data: 'echo hello' });
    });

    it('should parse OSC 633 P sequence with Cwd property', () => {
      const parser = new Osc633Parser();
      const result = parser.parse('\x1b]633;P;Cwd=/home/user\x07');

      expect(result.filteredOutput).toBe('');
      expect(result.sequences).toHaveLength(1);
      expect(result.sequences[0]).toEqual({ type: 'P', data: 'Cwd=/home/user' });
    });

    it('should handle multiple sequences in one chunk', () => {
      const parser = new Osc633Parser();
      const result = parser.parse(
        '\x1b]633;A\x07user@host:~$ \x1b]633;B\x07ls\x1b]633;E;ls\x07\x1b]633;C\x07'
      );

      expect(result.filteredOutput).toBe('user@host:~$ ls');
      expect(result.sequences).toHaveLength(4);
      expect(result.sequences[0].type).toBe('A');
      expect(result.sequences[1].type).toBe('B');
      expect(result.sequences[2].type).toBe('E');
      expect(result.sequences[3].type).toBe('C');
    });

    it('should buffer incomplete sequences across chunks', () => {
      const parser = new Osc633Parser();

      // First chunk ends in middle of sequence
      const result1 = parser.parse('before\x1b]633;');
      expect(result1.filteredOutput).toBe('before');
      expect(result1.sequences).toHaveLength(0);
      expect(parser.hasPartialSequence()).toBe(true);

      // Second chunk completes the sequence
      const result2 = parser.parse('D;0\x07after');
      expect(result2.filteredOutput).toBe('after');
      expect(result2.sequences).toHaveLength(1);
      expect(result2.sequences[0]).toEqual({ type: 'D', data: '0' });
      expect(parser.hasPartialSequence()).toBe(false);
    });

    it('should ignore invalid OSC 633 types', () => {
      const parser = new Osc633Parser();
      const result = parser.parse('\x1b]633;X\x07');

      expect(result.filteredOutput).toBe('');
      expect(result.sequences).toHaveLength(0);
    });

    it('should handle empty content', () => {
      const parser = new Osc633Parser();
      const result = parser.parse('');

      expect(result.filteredOutput).toBe('');
      expect(result.sequences).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('should clear buffered partial sequence', () => {
      const parser = new Osc633Parser();

      // Create partial sequence
      parser.parse('text\x1b]633;');
      expect(parser.hasPartialSequence()).toBe(true);

      // Reset clears it
      parser.reset();
      expect(parser.hasPartialSequence()).toBe(false);
    });
  });
});

describe('unescapeOsc633Command', () => {
  it('should unescape newlines', () => {
    expect(unescapeOsc633Command('echo\\nhello')).toBe('echo\nhello');
  });

  it('should unescape semicolons', () => {
    expect(unescapeOsc633Command('echo a\\;b')).toBe('echo a;b');
  });

  it('should unescape backslashes', () => {
    expect(unescapeOsc633Command('echo \\\\')).toBe('echo \\');
  });

  it('should handle multiple escapes', () => {
    expect(unescapeOsc633Command('cmd\\;\\n\\\\')).toBe('cmd;\n\\');
  });

  it('should handle text without escapes', () => {
    expect(unescapeOsc633Command('simple command')).toBe('simple command');
  });
});

describe('parseExitCode', () => {
  it('should parse valid exit codes', () => {
    expect(parseExitCode('0')).toBe(0);
    expect(parseExitCode('1')).toBe(1);
    expect(parseExitCode('127')).toBe(127);
    expect(parseExitCode('255')).toBe(255);
  });

  it('should return 0 for undefined', () => {
    expect(parseExitCode(undefined)).toBe(0);
  });

  it('should return 0 for invalid input', () => {
    expect(parseExitCode('')).toBe(0);
    expect(parseExitCode('abc')).toBe(0);
  });
});

describe('parseProperty', () => {
  it('should parse Cwd property', () => {
    expect(parseProperty('Cwd=/home/user')).toEqual({
      key: 'Cwd',
      value: '/home/user'
    });
  });

  it('should handle values with equals signs', () => {
    expect(parseProperty('Key=val=ue')).toEqual({
      key: 'Key',
      value: 'val=ue'
    });
  });

  it('should return null for undefined', () => {
    expect(parseProperty(undefined)).toBeNull();
  });

  it('should return null for invalid format', () => {
    expect(parseProperty('no-equals')).toBeNull();
    expect(parseProperty('')).toBeNull();
  });
});
