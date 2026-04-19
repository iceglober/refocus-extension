import type {
  FloatingIconSettings,
  GroupSettings,
  PrEventKind,
  Rule,
  Settings,
  StaleSettings,
  SuspendSettings,
} from './types';

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

export const DEFAULT_SUSPEND: SuspendSettings = {
  enabled: false,
  idleMinutes: 30,
  exemptHosts: [],
  suspendPinned: false,
};

export const DEFAULT_STALE: StaleSettings = {
  enabled: false,
  staleAfterHours: 48,
  graceMinutes: 60,
  maxAutoClose: 5,
};

export const DEFAULT_GROUPS: GroupSettings = {
  enabled: false,
  mode: 'domain',
  rules: [],
  collapseAfterMinutes: 0,
};

export const DEFAULT_FLOATING_ICON: FloatingIconSettings = {
  enabled: false,
};

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 2,
  dedup: {
    globalEnabled: true,
    disabledHosts: [],
    rules: DEFAULT_RULES,
    addressBarDedup: false,
  },
  watch: {
    enabled: false,
    apiBaseUrl: 'https://api.github.com',
    pollIntervalSec: 30,
    autoTargets: {
      authored: true,
      assigned: true,
      reviewRequested: true,
    },
    explicitPrs: [],
    notifyOn: DEFAULT_NOTIFY_ON,
    repoMutes: [],
  },
  suspend: DEFAULT_SUSPEND,
  stale: DEFAULT_STALE,
  groups: DEFAULT_GROUPS,
  floatingIcon: DEFAULT_FLOATING_ICON,
};
