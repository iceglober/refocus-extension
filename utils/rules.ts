import type { Rule } from './types';
import { safeParse } from './urlGuards';

export function matchHostGlob(host: string, glob: string): boolean {
  if (glob === '*' || glob === host) return true;
  if (!glob.startsWith('*.')) return false;
  const suffix = glob.slice(2);
  return host === suffix || host.endsWith('.' + suffix);
}

export function matchRule(
  rawUrl: string,
  rules: readonly Rule[],
): Rule | null {
  const url = safeParse(rawUrl);
  if (!url) return null;

  const sorted = rules
    .filter((r) => r.enabled)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    if (!matchHostGlob(url.host, rule.match.hostGlob)) continue;
    if (rule.match.pathRegex) {
      let re: RegExp;
      try {
        re = new RegExp(rule.match.pathRegex);
      } catch {
        continue;
      }
      if (!re.test(url.pathname)) continue;
    }
    return rule;
  }
  return null;
}

export function isDisabledHost(
  rawUrl: string,
  disabledHosts: readonly string[],
): boolean {
  const url = safeParse(rawUrl);
  if (!url) return false;
  return disabledHosts.some((h) => matchHostGlob(url.host, h));
}
