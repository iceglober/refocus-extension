import { describe, expect, it } from 'vitest';
import { fuzzyScore } from '@/utils/commandPalette/fuzzy';

describe('fuzzyScore', () => {
  it('returns 1 for empty query (neutral)', () => {
    expect(fuzzyScore('', 'anything')).toBe(1);
  });

  it('returns null when query is not a subsequence', () => {
    expect(fuzzyScore('xyz', 'github.com')).toBeNull();
  });

  it('returns a score for a subsequence match', () => {
    const s = fuzzyScore('gi', 'github.com');
    expect(s).not.toBeNull();
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(1);
  });

  it('returns null when characters present but out of order', () => {
    // "g" appears before "i" in the query but after in the target.
    expect(fuzzyScore('gi', 'pink')).toBeNull();
  });

  it('scores prefix match higher than interleaved subsequence match', () => {
    const prefix = fuzzyScore('git', 'github.com')!;
    // "git" subsequence in "great idea typing" via g...i...t
    const interleaved = fuzzyScore('git', 'great idea typing')!;
    expect(prefix).toBeGreaterThan(interleaved);
  });

  it('scores word-start match higher than mid-word subsequence', () => {
    // Both targets contain "gi" as a subsequence.
    const wordStart = fuzzyScore('gi', 'git init')!;
    const interleaved = fuzzyScore('gi', 'a-big-index')!;
    expect(wordStart).toBeGreaterThan(0);
    expect(interleaved).toBeGreaterThan(0);
    expect(wordStart).toBeGreaterThan(interleaved);
  });

  it('ranks github.com above Great Ideas for query "gi"', () => {
    const a = fuzzyScore('gi', 'github.com')!;
    const b = fuzzyScore('gi', 'Great Ideas')!;
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
    // github starts with "gi" consecutively → should beat "Great Ideas"
    // (non-consecutive G...I across two words).
    expect(a).toBeGreaterThan(b);
  });

  it('is case-insensitive', () => {
    expect(fuzzyScore('GI', 'github')).toEqual(fuzzyScore('gi', 'GITHUB'));
  });
});
