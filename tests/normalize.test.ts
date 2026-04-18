import { describe, expect, it } from 'vitest';
import { canonicalize } from '@/utils/normalize';
import type { NormalizerSpec } from '@/utils/types';

const githubPr: NormalizerSpec[] = [{ kind: 'builtin', id: 'github-pr' }];
const githubIssue: NormalizerSpec[] = [{ kind: 'builtin', id: 'github-issue' }];
const gdocs: NormalizerSpec[] = [{ kind: 'builtin', id: 'google-docs' }];
const yt: NormalizerSpec[] = [{ kind: 'builtin', id: 'youtube-video' }];
const stripFrag: NormalizerSpec[] = [{ kind: 'stripFragment' }];
const stripTrack: NormalizerSpec[] = [{ kind: 'stripTrackingParams' }];

describe('github-pr', () => {
  it.each([
    ['https://github.com/foo/bar/pull/1', 'https://github.com/foo/bar/pull/1'],
    [
      'https://github.com/foo/bar/pull/1/files',
      'https://github.com/foo/bar/pull/1',
    ],
    [
      'https://github.com/foo/bar/pull/1/commits',
      'https://github.com/foo/bar/pull/1',
    ],
    [
      'https://github.com/foo/bar/pull/1/files#r123',
      'https://github.com/foo/bar/pull/1',
    ],
    [
      'https://github.com/foo/bar/pull/1?notification=1',
      'https://github.com/foo/bar/pull/1',
    ],
    [
      'https://github.com/foo-org/some-repo/pull/9876/checks',
      'https://github.com/foo-org/some-repo/pull/9876',
    ],
  ])('%s → %s', (input, expected) => {
    expect(canonicalize(input, githubPr)).toBe(expected);
  });

  it('passes through non-PR github URLs unchanged', () => {
    expect(canonicalize('https://github.com/foo/bar', githubPr)).toBe(
      'https://github.com/foo/bar',
    );
  });

  it('passes through non-github URLs unchanged', () => {
    expect(canonicalize('https://example.com/pull/1', githubPr)).toBe(
      'https://example.com/pull/1',
    );
  });
});

describe('github-issue', () => {
  it('collapses issue subpaths', () => {
    expect(
      canonicalize('https://github.com/foo/bar/issues/42/events', githubIssue),
    ).toBe('https://github.com/foo/bar/issues/42');
  });
});

describe('google-docs', () => {
  it.each([
    [
      'https://docs.google.com/document/d/ABC123/edit',
      'https://docs.google.com/document/d/ABC123/edit',
    ],
    [
      'https://docs.google.com/document/d/ABC123/view',
      'https://docs.google.com/document/d/ABC123/edit',
    ],
    [
      'https://docs.google.com/document/d/ABC123/edit?usp=sharing',
      'https://docs.google.com/document/d/ABC123/edit',
    ],
    [
      'https://docs.google.com/spreadsheets/d/XYZ/edit#gid=0',
      'https://docs.google.com/spreadsheets/d/XYZ/edit',
    ],
  ])('%s → %s', (input, expected) => {
    expect(canonicalize(input, gdocs)).toBe(expected);
  });
});

describe('youtube-video', () => {
  it.each([
    [
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    ],
    [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    ],
    [
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    ],
  ])('%s → %s', (input, expected) => {
    expect(canonicalize(input, yt)).toBe(expected);
  });
});

describe('stripFragment', () => {
  it('removes hash', () => {
    expect(canonicalize('https://ex.com/a#b', stripFrag)).toBe(
      'https://ex.com/a',
    );
  });
});

describe('stripTrackingParams', () => {
  it('removes utm_* and friends, preserves other params', () => {
    expect(
      canonicalize(
        'https://ex.com/?id=1&utm_source=x&utm_campaign=y',
        stripTrack,
      ),
    ).toBe('https://ex.com/?id=1');
  });
});

describe('regex normalizer', () => {
  it('rewrites via capture groups', () => {
    const pipe: NormalizerSpec[] = [
      {
        kind: 'regex',
        pattern: '^https://linear\\.app/[^/]+/issue/([A-Z]+-\\d+).*$',
        canonical: 'https://linear.app/issue/$1',
      },
    ];
    expect(
      canonicalize('https://linear.app/acme/issue/ABC-123/some-title', pipe),
    ).toBe('https://linear.app/issue/ABC-123');
  });

  it('returns original url when pattern does not match', () => {
    const pipe: NormalizerSpec[] = [
      { kind: 'regex', pattern: '^NO_MATCH$', canonical: 'https://x.com/' },
    ];
    expect(canonicalize('https://ex.com/a', pipe)).toBe('https://ex.com/a');
  });
});

describe('stripQuery', () => {
  it('removes all params when except is empty', () => {
    const pipe: NormalizerSpec[] = [{ kind: 'stripQuery' }];
    expect(canonicalize('https://ex.com/?a=1&b=2', pipe)).toBe(
      'https://ex.com/',
    );
  });

  it('keeps listed params', () => {
    const pipe: NormalizerSpec[] = [{ kind: 'stripQuery', except: ['a'] }];
    expect(canonicalize('https://ex.com/?a=1&b=2', pipe)).toBe(
      'https://ex.com/?a=1',
    );
  });
});

describe('pathPrefix', () => {
  it('keeps only the first N path segments', () => {
    const pipe: NormalizerSpec[] = [{ kind: 'pathPrefix', segments: 2 }];
    expect(canonicalize('https://ex.com/a/b/c/d', pipe)).toBe(
      'https://ex.com/a/b',
    );
  });
});

// ============================================================================
// Conformance suite — runs every combo against all fixtures
// ============================================================================

const CONFORMANCE_PIPELINES: Array<[string, NormalizerSpec[]]> = [
  ['identity', [{ kind: 'identity' }]],
  ['stripFragment', stripFrag],
  ['stripTracking', stripTrack],
  ['github-pr', githubPr],
  ['github-issue', githubIssue],
  ['google-docs', gdocs],
  ['youtube-video', yt],
  [
    'github-pr + stripFragment',
    [
      { kind: 'builtin', id: 'github-pr' },
      { kind: 'stripFragment' },
    ],
  ],
];

const CORPUS = [
  'https://github.com/foo/bar/pull/1',
  'https://github.com/foo/bar/pull/1/files#r999',
  'https://github.com/foo/bar/issues/42',
  'https://docs.google.com/document/d/X/edit',
  'https://www.youtube.com/watch?v=abc&t=10',
  'https://example.com/',
  'https://example.com/a/b/c?x=1&utm_source=y#top',
  'http://localhost:3000/',
  'https://subdomain.example.com/path?a=1#x',
];

describe('conformance', () => {
  for (const [name, pipeline] of CONFORMANCE_PIPELINES) {
    for (const url of CORPUS) {
      it(`[${name}] idempotent: ${url}`, () => {
        const once = canonicalize(url, pipeline);
        const twice = canonicalize(once, pipeline);
        expect(twice).toBe(once);
      });

      it(`[${name}] scheme-preserving: ${url}`, () => {
        const parsed = new URL(url);
        const canon = new URL(canonicalize(url, pipeline));
        expect(canon.protocol).toBe(parsed.protocol);
      });

      it(`[${name}] host-preserving (when parseable): ${url}`, () => {
        const parsed = new URL(url);
        const canon = new URL(canonicalize(url, pipeline));
        expect(canon.host).toBe(parsed.host);
      });
    }
  }

  it('never throws on garbage input', () => {
    expect(() => canonicalize('not a url', githubPr)).not.toThrow();
    expect(() => canonicalize('', githubPr)).not.toThrow();
  });
});
