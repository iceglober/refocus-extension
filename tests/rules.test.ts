import { describe, expect, it } from 'vitest';
import { isDisabledHost, matchRule } from '@/utils/rules';
import type { Rule } from '@/utils/types';

const baseRule = (overrides: Partial<Rule>): Rule => ({
  id: 'r',
  name: 'r',
  enabled: true,
  match: { hostGlob: '*' },
  pipeline: [{ kind: 'identity' }],
  scope: 'profile',
  priority: 0,
  ...overrides,
});

describe('matchRule', () => {
  it('returns higher priority rule first', () => {
    const lo = baseRule({ id: 'lo', priority: 0, match: { hostGlob: '*' } });
    const hi = baseRule({
      id: 'hi',
      priority: 100,
      match: { hostGlob: 'github.com' },
    });
    expect(matchRule('https://github.com/a/b', [lo, hi])?.id).toBe('hi');
  });

  it('skips disabled rules', () => {
    const r = baseRule({ id: 'x', enabled: false });
    expect(matchRule('https://x.com/', [r])).toBeNull();
  });

  it('honors pathRegex', () => {
    const r = baseRule({
      match: { hostGlob: 'x.com', pathRegex: '^/api/' },
    });
    expect(matchRule('https://x.com/api/y', [r])?.id).toBe('r');
    expect(matchRule('https://x.com/other', [r])).toBeNull();
  });

  it('returns null when nothing matches', () => {
    const r = baseRule({ match: { hostGlob: 'y.com' } });
    expect(matchRule('https://x.com/', [r])).toBeNull();
  });

  it('handles invalid pathRegex gracefully', () => {
    const r = baseRule({
      match: { hostGlob: 'x.com', pathRegex: '(' },
    });
    expect(matchRule('https://x.com/', [r])).toBeNull();
  });

  it('returns null for unparseable URL', () => {
    const r = baseRule({});
    expect(matchRule('not a url', [r])).toBeNull();
  });
});

describe('isDisabledHost', () => {
  it('matches exact host', () => {
    expect(isDisabledHost('https://figma.com/', ['figma.com'])).toBe(true);
  });
  it('matches subdomain via *.glob', () => {
    expect(isDisabledHost('https://foo.figma.com/', ['*.figma.com'])).toBe(
      true,
    );
  });
  it('does not match unrelated host', () => {
    expect(isDisabledHost('https://github.com/', ['figma.com'])).toBe(false);
  });
});
