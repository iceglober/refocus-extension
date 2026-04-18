import type { PrEvent, PrState } from '../types';
import type { PrSnapshot } from './snapshot';

export interface DiffResult {
  events: PrEvent[];
  nextState: PrState;
}

export function diff(
  prev: PrState,
  snap: PrSnapshot,
  viewerLogin: string,
): DiffResult {
  const now = Date.now();

  const next: PrState = {
    lastSeenSha: snap.sha,
    lastRollupState: snap.rollupState,
    lastReviewIds: snap.reviews.slice(-20).map((r) => r.id),
    lastCommentIds: snap.comments.slice(-10).map((c) => c.id),
    lastMentionCommentIds: prev.lastMentionCommentIds.slice(),
    merged: snap.merged,
    closed: snap.closed,
    lastMergeable: snap.mergeable,
    updatedAt: now,
    ...(prev.firstPendingAt !== undefined
      ? { firstPendingAt: prev.firstPendingAt }
      : {}),
  };

  if (prev.lastSeenSha === '') return { events: [], nextState: next };

  const events: PrEvent[] = [];
  if (prev.lastSeenSha !== snap.sha) delete next.firstPendingAt;

  if (snap.rollupState === 'PENDING' && prev.lastRollupState !== 'PENDING') {
    events.push({ kind: 'checks.pending', pr: snap.ref, sha: snap.sha });
    next.firstPendingAt = now;
  }

  if (snap.rollupState === 'SUCCESS' && prev.lastRollupState !== 'SUCCESS') {
    const startAt = next.firstPendingAt;
    const durationMs = startAt ? now - startAt : undefined;
    events.push({
      kind: 'checks.passed',
      pr: snap.ref,
      sha: snap.sha,
      ...(durationMs !== undefined ? { durationMs } : {}),
    });
  }

  if (
    (snap.rollupState === 'FAILURE' || snap.rollupState === 'ERROR') &&
    prev.lastRollupState !== 'FAILURE' &&
    prev.lastRollupState !== 'ERROR'
  ) {
    events.push({
      kind: 'checks.failed',
      pr: snap.ref,
      sha: snap.sha,
      failing: snap.failingContexts,
    });
  }

  const prevReviewSet = new Set(prev.lastReviewIds);
  for (const r of snap.reviews) {
    if (!prevReviewSet.has(r.id)) {
      events.push({
        kind: 'review.submitted',
        pr: snap.ref,
        reviewId: r.id,
        reviewer: r.reviewer,
        state: r.state,
      });
    }
  }

  if (viewerLogin) {
    const prevMentionSet = new Set(prev.lastMentionCommentIds);
    const prevCommentSet = new Set(prev.lastCommentIds);
    const mentionRe = new RegExp(
      `(?:^|[^a-zA-Z0-9_])@${escapeRegex(viewerLogin)}\\b`,
      'i',
    );
    const viewerLower = viewerLogin.toLowerCase();
    for (const c of snap.comments) {
      if (prevCommentSet.has(c.id)) continue;
      if (c.author.toLowerCase() === viewerLower) continue;
      if (!mentionRe.test(c.body)) continue;
      if (prevMentionSet.has(c.id)) continue;
      events.push({
        kind: 'mention',
        pr: snap.ref,
        commentId: c.id,
        commentUrl: c.url,
        author: c.author,
      });
      next.lastMentionCommentIds = [...next.lastMentionCommentIds, c.id].slice(
        -50,
      );
    }
  }

  if (snap.merged && !prev.merged) events.push({ kind: 'merged', pr: snap.ref });
  if (snap.closed && !snap.merged && !prev.closed)
    events.push({ kind: 'closed', pr: snap.ref });

  if (prev.lastMergeable !== null) {
    if (snap.mergeable === 'CONFLICTING' && prev.lastMergeable !== 'CONFLICTING') {
      events.push({ kind: 'conflict.added', pr: snap.ref });
    }
    if (snap.mergeable === 'MERGEABLE' && prev.lastMergeable === 'CONFLICTING') {
      events.push({ kind: 'conflict.cleared', pr: snap.ref });
    }
  }

  return { events, nextState: next };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
