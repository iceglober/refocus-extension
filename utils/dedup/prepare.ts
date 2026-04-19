import { canonicalize } from '../normalize';
import { isDisabledHost, matchRule } from '../rules';
import type { CanonicalUrl, Rule, Settings } from '../types';
import { isInternalUrl } from '../urlGuards';

export function prepareDedup(
  url: string | undefined,
  pinned: boolean,
  settings: Settings,
): { rule: Rule; canonical: CanonicalUrl } | null {
  if (!settings.dedup.globalEnabled) return null;
  if (!url || isInternalUrl(url)) return null;
  if (pinned) return null;
  if (isDisabledHost(url, settings.dedup.disabledHosts)) return null;

  const rule = matchRule(url, settings.dedup.rules);
  if (!rule) return null;

  return { rule, canonical: canonicalize(url, rule.pipeline) };
}
