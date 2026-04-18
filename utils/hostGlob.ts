// Supports "*" (any host), "foo.com" (exact), "*.foo.com" (subdomains of foo.com).
// Does NOT support mid-label wildcards like "api*.foo.com".
export function matchHostGlob(host: string, glob: string): boolean {
  if (glob === '*') return true;
  if (glob === host) return true;
  if (glob.startsWith('*.')) {
    const suffix = glob.slice(2);
    return host === suffix || host.endsWith('.' + suffix);
  }
  return false;
}
