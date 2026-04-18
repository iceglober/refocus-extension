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

function extractFailing(
  rollup: GqlPr['commits']['nodes'][number]['commit']['statusCheckRollup'],
): string[] {
  if (!rollup) return [];
  const out: string[] = [];
  for (const ctx of rollup.contexts.nodes) {
    if (ctx.__typename === 'CheckRun') {
      if (
        ctx.conclusion === 'FAILURE' ||
        ctx.conclusion === 'TIMED_OUT' ||
        ctx.conclusion === 'CANCELLED'
      ) {
        out.push(ctx.name);
      }
    } else if (ctx.__typename === 'StatusContext') {
      if (ctx.state === 'FAILURE' || ctx.state === 'ERROR')
        out.push(ctx.context);
    }
  }
  return out;
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
