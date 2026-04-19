import type { GqlPr } from '../github/types';
import type { PrRef, PrState, ReviewState, RollupState } from '../types';

export interface PrSnapshot {
  ref: PrRef;
  sha: string;
  rollupState: RollupState | null;
  failingContexts: readonly string[];
  reviews: ReadonlyArray<{
    id: string;
    reviewer: string;
    state: ReviewState;
  }>;
  comments: ReadonlyArray<{
    id: string;
    author: string;
    body: string;
    url: string;
  }>;
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
  merged: boolean;
  closed: boolean;
}

export function toSnapshot(pr: GqlPr): PrSnapshot {
  const commit = pr.commits.nodes[0]?.commit;
  const rollup = commit?.statusCheckRollup ?? null;
  const failing = extractFailing(rollup);

  return {
    ref: {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      repo: pr.repository.nameWithOwner,
    },
    sha: commit?.oid ?? '',
    rollupState: rollup?.state ?? null,
    failingContexts: failing,
    reviews: pr.reviews.nodes.map((r) => ({
      id: r.id,
      reviewer: r.author?.login ?? 'unknown',
      state: r.state,
    })),
    comments: pr.comments.nodes.map((c) => ({
      id: c.id,
      author: c.author?.login ?? 'unknown',
      body: c.bodyText,
      url: c.url,
    })),
    mergeable: pr.mergeable,
    merged: pr.merged,
    closed: pr.closed,
  };
}

const FAILING_CHECK = new Set(['FAILURE', 'TIMED_OUT', 'CANCELLED']);
const FAILING_STATUS = new Set(['FAILURE', 'ERROR']);

function extractFailing(
  rollup: GqlPr['commits']['nodes'][number]['commit']['statusCheckRollup'],
): string[] {
  if (!rollup) return [];
  return rollup.contexts.nodes.flatMap((ctx) => {
    if (ctx.__typename === 'CheckRun')
      return FAILING_CHECK.has(ctx.conclusion ?? '') ? [ctx.name] : [];
    return FAILING_STATUS.has(ctx.state) ? [ctx.context] : [];
  });
}

export function emptyState(): PrState {
  return {
    lastSeenSha: '',
    lastRollupState: null,
    lastReviewIds: [],
    lastCommentIds: [],
    lastMentionCommentIds: [],
    merged: false,
    closed: false,
    lastMergeable: null,
    updatedAt: Date.now(),
  };
}
