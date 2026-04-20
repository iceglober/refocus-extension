/**
 * Canonicalize a URL for palette dedup purposes.
 * - Lowercases hostname
 * - Drops fragment
 * - Strips common tracking params (does NOT strip `ref` / `ref_src` since
 *   they carry meaning on GitHub and similar sites)
 * - Preserves path and remaining query
 * - Normalizes trailing slash on root path only
 * - Returns the input unchanged on parse failure
 */
const TRACKING_PARAM =
  /^(?:utm_|mc_|mkt_tok$|_ga$|fbclid$|gclid$|igshid$|yclid$|vero_id$)/i;

export function paletteCanonicalize(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }

  u.hash = '';
  u.hostname = u.hostname.toLowerCase();

  const drop: string[] = [];
  u.searchParams.forEach((_, key) => {
    if (TRACKING_PARAM.test(key)) drop.push(key);
  });
  for (const key of drop) u.searchParams.delete(key);

  // Keep root path as `/`; don't touch other paths.
  if (u.pathname === '') u.pathname = '/';

  return u.toString();
}
