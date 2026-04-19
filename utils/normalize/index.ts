import type { BuiltinId, CanonicalUrl, NormalizerSpec } from '../types';

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

const GITHUB_PR_RE = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/.*)?$/;
const GITHUB_ISSUE_RE = /^\/([^/]+)\/([^/]+)\/issues\/(\d+)(?:\/.*)?$/;
const GDOC_RES: Array<[RegExp, string]> = [
  [/^\/document\/d\/([^/]+)(?:\/.*)?$/, 'document'],
  [/^\/spreadsheets\/d\/([^/]+)(?:\/.*)?$/, 'spreadsheets'],
  [/^\/presentation\/d\/([^/]+)(?:\/.*)?$/, 'presentation'],
];
const YT_HOSTS = new Set(['www.youtube.com', 'youtube.com', 'm.youtube.com']);

const BUILTINS: Record<BuiltinId, (url: URL) => URL | null> = {
  'github-pr': (url) => {
    if (url.host !== 'github.com') return null;
    const m = GITHUB_PR_RE.exec(url.pathname);
    return m ? new URL(`https://github.com/${m[1]}/${m[2]}/pull/${m[3]}`) : null;
  },
  'github-issue': (url) => {
    if (url.host !== 'github.com') return null;
    const m = GITHUB_ISSUE_RE.exec(url.pathname);
    return m
      ? new URL(`https://github.com/${m[1]}/${m[2]}/issues/${m[3]}`)
      : null;
  },
  'google-docs': (url) => {
    if (url.host !== 'docs.google.com') return null;
    for (const [re, kind] of GDOC_RES) {
      const m = re.exec(url.pathname);
      if (m) return new URL(`https://docs.google.com/${kind}/d/${m[1]}/edit`);
    }
    return null;
  },
  'youtube-video': (url) => {
    if (url.host === 'youtu.be') {
      const id = url.pathname.slice(1);
      return id ? new URL(`https://www.youtube.com/watch?v=${id}`) : null;
    }
    if (!YT_HOSTS.has(url.host) || url.pathname !== '/watch') return null;
    const v = url.searchParams.get('v');
    return v ? new URL(`https://www.youtube.com/watch?v=${v}`) : null;
  },
};

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
      const u = new URL(url.href);
      u.hash = '';
      return u;
    }

    case 'stripQuery': {
      const u = new URL(url.href);
      const keep = new Set(step.except ?? []);
      [...u.searchParams.keys()].forEach((k) => {
        if (!keep.has(k)) u.searchParams.delete(k);
      });
      return u;
    }

    case 'stripTrackingParams': {
      const u = new URL(url.href);
      [...u.searchParams.keys()].forEach((k) => {
        if (TRACKING_PARAMS.has(k)) u.searchParams.delete(k);
      });
      return u;
    }

    case 'pathPrefix': {
      const u = new URL(url.href);
      const parts = u.pathname.split('/').filter(Boolean);
      u.pathname = '/' + parts.slice(0, step.segments).join('/');
      return u;
    }

    case 'regex': {
      let re: RegExp;
      try {
        re = new RegExp(step.pattern);
      } catch {
        return null;
      }
      const m = re.exec(url.href);
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

    case 'builtin':
      return BUILTINS[step.id]?.(url) ?? null;
  }
}
