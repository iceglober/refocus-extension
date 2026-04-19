import { describe, expect, it } from 'vitest';
import { isInternalUrl, safeParse } from '@/utils/urlGuards';

describe('isInternalUrl', () => {
  it.each([
    'chrome://settings/',
    'chrome-extension://abc/popup.html',
    'edge://newtab/',
    'about:blank',
    'about:newtab',
    'brave://rewards',
    'data:text/plain;base64,aGk=',
    'javascript:void(0)',
    'view-source:https://example.com/',
  ])('flags %s as internal', (url) => {
    expect(isInternalUrl(url)).toBe(true);
  });

  it.each([
    'https://github.com/',
    'http://localhost:3000/',
    'https://docs.google.com/document/d/X/edit',
  ])('allows %s as external', (url) => {
    expect(isInternalUrl(url)).toBe(false);
  });

  it('treats unparseable URLs as internal (safety-first)', () => {
    expect(isInternalUrl('not a url')).toBe(true);
    expect(isInternalUrl('')).toBe(true);
  });
});

describe('safeParse', () => {
  it('parses valid URLs', () => {
    expect(safeParse('https://example.com/a')?.host).toBe('example.com');
  });

  it('returns null for invalid URLs', () => {
    expect(safeParse('not a url')).toBeNull();
    expect(safeParse('')).toBeNull();
  });
});
