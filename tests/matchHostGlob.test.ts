import { describe, expect, it } from 'vitest';
import { matchHostGlob } from '@/utils/rules';

describe('matchHostGlob', () => {
  it('wildcard matches anything', () => {
    expect(matchHostGlob('github.com', '*')).toBe(true);
  });

  it('exact match', () => {
    expect(matchHostGlob('github.com', 'github.com')).toBe(true);
    expect(matchHostGlob('gitlab.com', 'github.com')).toBe(false);
  });

  it('subdomain wildcard matches subdomains', () => {
    expect(matchHostGlob('api.github.com', '*.github.com')).toBe(true);
    expect(matchHostGlob('deep.api.github.com', '*.github.com')).toBe(true);
  });

  it('subdomain wildcard matches the base domain too', () => {
    expect(matchHostGlob('github.com', '*.github.com')).toBe(true);
  });

  it('does not match partial prefix without wildcard', () => {
    expect(matchHostGlob('notgithub.com', '*.github.com')).toBe(false);
  });

  it('non-wildcard prefix does not match', () => {
    expect(matchHostGlob('github.com', 'hub.com')).toBe(false);
  });
});
