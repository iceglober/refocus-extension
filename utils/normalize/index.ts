import type { CanonicalUrl, NormalizerSpec } from '../types';
import { BUILTINS } from './registry';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'ref',
  'ref_src',
  '_hsenc',
  '_hsmi',
  'yclid',
  'dclid',
  'wt_mc',
  'pk_campaign',
]);

export function canonicalize(
  raw: string,
  pipeline: readonly NormalizerSpec[],
): CanonicalUrl {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw as CanonicalUrl;
  }

  for (const step of pipeline) {
    const out = applyStep(url, step);
    if (out !== null) url = out;
  }
  return url.toString() as CanonicalUrl;
}

function applyStep(url: URL, step: NormalizerSpec): URL | null {
  switch (step.kind) {
    case 'identity':
      return url;

    case 'stripFragment': {
      const u = new URL(url.toString());
      u.hash = '';
      return u;
    }

    case 'stripQuery': {
      const u = new URL(url.toString());
      if (!step.except || step.except.length === 0) {
        u.search = '';
      } else {
        const keep = new Set(step.except);
        const preserved: [string, string][] = [];
        u.searchParams.forEach((v, k) => {
          if (keep.has(k)) preserved.push([k, v]);
        });
        u.search = '';
        preserved.forEach(([k, v]) => u.searchParams.append(k, v));
      }
      return u;
    }

    case 'stripTrackingParams': {
      const u = new URL(url.toString());
      const toDelete: string[] = [];
      u.searchParams.forEach((_, k) => {
        if (TRACKING_PARAMS.has(k)) toDelete.push(k);
      });
      toDelete.forEach((k) => u.searchParams.delete(k));
      return u;
    }

    case 'pathPrefix': {
      const u = new URL(url.toString());
      const parts = u.pathname.split('/').filter(Boolean);
      const kept = parts.slice(0, step.segments);
      u.pathname = '/' + kept.join('/');
      return u;
    }

    case 'regex': {
      let re: RegExp;
      try {
        re = new RegExp(step.pattern);
      } catch {
        return null;
      }
      const full = url.toString();
      const m = re.exec(full);
      if (!m) return null;
      let out = step.canonical;
      for (let i = m.length - 1; i >= 0; i--) {
        out = out.replaceAll(`$${i}`, m[i] ?? '');
      }
      try {
        return new URL(out);
      } catch {
        return null;
      }
    }

    case 'builtin': {
      const fn = BUILTINS[step.id];
      if (!fn) return null;
      return fn(url);
    }
  }
}
