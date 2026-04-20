import { describe, expect, it } from 'vitest';
import { paletteCanonicalize } from '@/utils/commandPalette/canonicalize';

describe('paletteCanonicalize', () => {
  it('drops fragment', () => {
    expect(paletteCanonicalize('https://example.com/a#x')).toBe(
      'https://example.com/a',
    );
  });

  it('lowercases hostname', () => {
    expect(paletteCanonicalize('https://Example.COM/Path')).toBe(
      'https://example.com/Path',
    );
  });

  it('strips utm_ / fbclid / gclid', () => {
    const out = paletteCanonicalize(
      'https://example.com/x?utm_source=foo&utm_medium=bar&fbclid=123&gclid=abc&keep=yes',
    );
    expect(out).toBe('https://example.com/x?keep=yes');
  });

  it('strips mkt_tok', () => {
    expect(
      paletteCanonicalize('https://example.com/x?mkt_tok=abc&real=1'),
    ).toBe('https://example.com/x?real=1');
  });

  it('PRESERVES `ref` and `ref_src`', () => {
    expect(
      paletteCanonicalize('https://github.com/org/repo/blob/main?ref=main'),
    ).toBe('https://github.com/org/repo/blob/main?ref=main');
    expect(
      paletteCanonicalize('https://twitter.com/x?ref_src=twsrc'),
    ).toBe('https://twitter.com/x?ref_src=twsrc');
  });

  it('returns the input unchanged on parse failure', () => {
    expect(paletteCanonicalize('not a url')).toBe('not a url');
  });

  it('dedups same logical URL with different tracking params', () => {
    const a = paletteCanonicalize('https://example.com/x?utm_source=a');
    const b = paletteCanonicalize('https://example.com/x?utm_source=b');
    expect(a).toBe(b);
  });
});
