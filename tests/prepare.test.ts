import { describe, expect, it } from 'vitest';
import { prepareDedup } from '@/utils/dedup/prepare';
import { DEFAULT_SETTINGS } from '@/utils/defaults';
import type { Settings } from '@/utils/types';

const settings = (overrides: Partial<Settings['dedup']> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  dedup: { ...DEFAULT_SETTINGS.dedup, ...overrides },
});

describe('prepareDedup', () => {
  it('returns rule + canonical for a matching URL', () => {
    const prep = prepareDedup(
      'https://github.com/a/b/pull/5/files',
      false,
      settings(),
    );
    expect(prep?.canonical).toBe('https://github.com/a/b/pull/5');
    expect(prep?.rule.name).toBe('GitHub Pull Requests');
  });

  it('returns null when globalEnabled is false', () => {
    expect(
      prepareDedup('https://github.com/a/b/pull/5', false, settings({ globalEnabled: false })),
    ).toBeNull();
  });

  it('returns null for internal URLs', () => {
    expect(prepareDedup('chrome://newtab/', false, settings())).toBeNull();
    expect(prepareDedup('about:blank', false, settings())).toBeNull();
  });

  it('returns null for pinned tabs', () => {
    expect(
      prepareDedup('https://github.com/a/b/pull/5', true, settings()),
    ).toBeNull();
  });

  it('returns null for disabled hosts', () => {
    expect(
      prepareDedup(
        'https://github.com/a/b/pull/5',
        false,
        settings({ disabledHosts: ['github.com'] }),
      ),
    ).toBeNull();
  });

  it('returns null for empty/undefined URL', () => {
    expect(prepareDedup(undefined, false, settings())).toBeNull();
    expect(prepareDedup('', false, settings())).toBeNull();
  });

  it('returns null when no rule matches (unknown host with no default * rule)', () => {
    expect(
      prepareDedup(
        'https://unknown.example/path',
        false,
        settings({ rules: [] }),
      ),
    ).toBeNull();
  });
});
