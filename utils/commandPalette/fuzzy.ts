/**
 * Lightweight subsequence-fuzzy-match scorer.
 *
 * Returns null if `query` is not a subsequence of `target`.
 * Otherwise returns a score in [0, 1]:
 *   base 0.5
 *   + 0.30 * consecutive-match fraction
 *   + 0.15 * word-start match fraction
 *   + 0.05 * (1 - firstMatchIndex / target.length)
 *
 * Empty query returns 1 (neutral — caller treats as "no filter").
 */
export function fuzzyScore(query: string, target: string): number | null {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  let qi = 0;
  let firstMatch = -1;
  let lastMatch = -2;
  let consecutive = 0;
  let wordStartHits = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) continue;
    if (firstMatch === -1) firstMatch = ti;
    if (ti === lastMatch + 1) consecutive++;
    const prev = ti === 0 ? '' : (t[ti - 1] ?? '');
    if (ti === 0 || !/[a-z0-9]/.test(prev)) wordStartHits++;
    lastMatch = ti;
    qi++;
  }

  if (qi < q.length) return null;

  const consecFrac = q.length > 1 ? consecutive / (q.length - 1) : 1;
  const wordStartFrac = wordStartHits / q.length;
  const startBias =
    target.length > 0 ? 1 - firstMatch / target.length : 1;

  const raw =
    0.5 + 0.3 * consecFrac + 0.15 * wordStartFrac + 0.05 * startBias;
  return Math.min(1, Math.max(0, raw));
}
