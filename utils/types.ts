// ============================================================================
// Normalizer spec — applied left-to-right in a pipeline
// ============================================================================

export type NormalizerSpec =
  | { kind: 'identity' }
  | { kind: 'stripFragment' }
  | { kind: 'stripQuery'; except?: readonly string[] }
  | { kind: 'stripTrackingParams' }
  | { kind: 'pathPrefix'; segments: number }
  | { kind: 'regex'; pattern: string; canonical: string }
  | { kind: 'builtin'; id: BuiltinId };

export type BuiltinId =
  | 'github-pr'
  | 'github-issue'
  | 'google-docs'
  | 'youtube-video';

// ============================================================================
// Rule
// ============================================================================

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  match: {
    hostGlob: string;
    pathRegex?: string;
  };
  pipeline: readonly NormalizerSpec[];
  scope: 'profile' | 'window';
  priority: number;
}

// ============================================================================
// Branded canonical URL
// ============================================================================

export type CanonicalUrl = string & { readonly __brand: 'canonical' };

// ============================================================================
// Watch — PR event domain
// ============================================================================

export type RollupState =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILURE'
  | 'ERROR'
  | 'EXPECTED';

export type ReviewState =
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'COMMENTED'
  | 'DISMISSED'
  | 'PENDING';

export interface PrRef {
  id: string;
  number: number;
  title: string;
  url: string;
  repo: string; // "owner/repo"
}

export type PrEvent =
  | { kind: 'checks.passed'; pr: PrRef; sha: string; durationMs?: number }
  | { kind: 'checks.failed'; pr: PrRef; sha: string; failing: readonly string[] }
  | { kind: 'checks.pending'; pr: PrRef; sha: string }
  | {
      kind: 'review.submitted';
      pr: PrRef;
      reviewId: string;
      reviewer: string;
      state: ReviewState;
    }
  | { kind: 'merged'; pr: PrRef }
  | { kind: 'closed'; pr: PrRef }
  | { kind: 'conflict.added'; pr: PrRef }
  | { kind: 'conflict.cleared'; pr: PrRef }
  | {
      kind: 'mention';
      pr: PrRef;
      commentId: string;
      commentUrl: string;
      author: string;
    };

export type PrEventKind = PrEvent['kind'];

export const ALL_EVENT_KINDS: readonly PrEventKind[] = [
  'checks.passed',
  'checks.failed',
  'checks.pending',
  'review.submitted',
  'merged',
  'closed',
  'conflict.added',
  'conflict.cleared',
  'mention',
] as const;

// ============================================================================
// PR polling state (local storage)
// ============================================================================

export interface PrState {
  lastSeenSha: string;
  lastRollupState: RollupState | null;
  lastReviewIds: readonly string[];
  lastCommentIds: readonly string[];
  lastMentionCommentIds: readonly string[];
  firstPendingAt?: number;
  merged: boolean;
  closed: boolean;
  lastMergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN' | null;
  updatedAt: number; // ms epoch for eviction
}

export type PrStateMap = Record<string, PrState>;

// ============================================================================
// Settings (sync storage)
// ============================================================================

export interface Settings {
  schemaVersion: 1;
  dedup: {
    globalEnabled: boolean;
    disabledHosts: string[];
    rules: Rule[];
    debug: boolean;
    addressBarDedup: boolean;
  };
  watch: {
    enabled: boolean;
    apiBaseUrl: string;
    pollIntervalSec: 30 | 60 | 120 | 300;
    autoTargets: {
      authored: boolean;
      assigned: boolean;
      reviewRequested: boolean;
    };
    explicitPrs: string[];
    explicitRepos: Array<{ repo: string; filter: 'all' | 'involving-me' }>;
    notifyOn: Record<PrEventKind, boolean>;
    repoMutes: string[];
    oauthClientId?: string;
  };
}

// ============================================================================
// Auth (local storage)
// ============================================================================

export interface Auth {
  mode: 'oauth' | 'pat' | 'none';
  token?: string;
  login?: string;
  expiresAt?: number;
}
