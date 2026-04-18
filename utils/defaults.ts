import type { PrEventKind, Rule, Settings } from './types';

export const DEFAULT_RULES: Rule[] = [
  {
    id: 'default-github-pr',
    name: 'GitHub Pull Requests',
    enabled: true,
    match: { hostGlob: 'github.com' },
    pipeline: [{ kind: 'builtin', id: 'github-pr' }],
    scope: 'profile',
    priority: 100,
  },
  {
    id: 'default-github-issue',
    name: 'GitHub Issues',
    enabled: true,
    match: { hostGlob: 'github.com' },
    pipeline: [{ kind: 'builtin', id: 'github-issue' }],
    scope: 'profile',
    priority: 100,
  },
  {
    id: 'default-exact',
    name: 'Exact URL match (fallback)',
    enabled: true,
    match: { hostGlob: '*' },
    pipeline: [{ kind: 'stripFragment' }],
    scope: 'profile',
    priority: 0,
  },
];

const DEFAULT_NOTIFY_ON: Record<PrEventKind, boolean> = {
  'checks.passed': true,
  'checks.failed': true,
  'checks.pending': false,
  'review.submitted': true,
  merged: true,
  closed: false,
  'conflict.added': true,
  'conflict.cleared': false,
  mention: true,
};

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  dedup: {
    globalEnabled: true,
    disabledHosts: [],
    rules: DEFAULT_RULES,
    debug: false,
    addressBarDedup: false,
  },
  watch: {
    enabled: false, // opt-in; Watch requires auth
    apiBaseUrl: 'https://api.github.com',
    pollIntervalSec: 30,
    autoTargets: {
      authored: true,
      assigned: true,
      reviewRequested: true,
    },
    explicitPrs: [],
    explicitRepos: [],
    notifyOn: DEFAULT_NOTIFY_ON,
    repoMutes: [],
  },
};
