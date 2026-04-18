import { describe, expect, it } from 'vitest';
import { escapeHtml } from '@/utils/html';

describe('escapeHtml', () => {
  it('escapes the five HTML entity characters', () => {
    expect(escapeHtml(`<b id="x">&'</b>`)).toBe(
      '&lt;b id=&quot;x&quot;&gt;&amp;&#39;&lt;/b&gt;',
    );
  });

  it('returns plain strings unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('is idempotent-safe against ampersand (double-escapes, by design)', () => {
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });
});
