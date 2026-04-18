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
  const events: PrEvent[] = [];
  const now = Date.now();
  const isFirstObservation = prev.lastSeenSha === '';

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

  // ----- Check rollup transitions -----
  const shaChanged = !isFirstObservation && prev.lastSeenSha !== snap.sha;
  if (shaChanged) {
    delete next.firstPendingAt;
  }

  if (
    snap.rollupState === 'PENDING' &&
    prev.lastRollupState !== 'PENDING' &&
    !isFirstObservation
  ) {
    events.push({ kind: 'checks.pending', pr: snap.ref, sha: snap.sha });
    next.firstPendingAt = now;
  }

  if (
    snap.rollupState === 'SUCCESS' &&
    prev.lastRollupState !== 'SUCCESS' &&
    !isFirstObservation
  ) {
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
    prev.lastRollupState !== 'ERROR' &&
    !isFirstObservation
  ) {
    events.push({
      kind: 'checks.failed',
      pr: snap.ref,
      sha: snap.sha,
      failing: snap.failingContexts,
    });
  }

  // ----- Reviews -----
  const prevReviewSet = new Set(prev.lastReviewIds);
  for (const r of snap.reviews) {
    if (!prevReviewSet.has(r.id) && !isFirstObservation) {
      events.push({
        kind: 'review.submitted',
        pr: snap.ref,
        reviewId: r.id,
        reviewer: r.reviewer,
        state: r.state,
      });
    }
  }

  // ----- Mentions -----
  const prevMentionSet = new Set(prev.lastMentionCommentIds);
  const prevCommentSet = new Set(prev.lastCommentIds);
  const mentionRe = new RegExp(
    `(?:^|[^a-zA-Z0-9_])@${escapeRegex(viewerLogin)}\\b`,
    'i',
  );

  for (const c of snap.comments) {
    if (prevCommentSet.has(c.id)) continue;
    if (isFirstObservation) continue;
    if (c.author.toLowerCase() === viewerLogin.toLowerCase()) continue;
    if (!viewerLogin) continue;
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

  // ----- Merged / closed -----
  if (snap.merged && !prev.merged)
    events.push({ kind: 'merged', pr: snap.ref });
  if (snap.closed && !snap.merged && !prev.closed)
    events.push({ kind: 'closed', pr: snap.ref });

  // ----- Conflicts -----
  if (prev.lastMergeable !== null && !isFirstObservation) {
    if (
      snap.mergeable === 'CONFLICTING' &&
      prev.lastMergeable !== 'CONFLICTING'
    ) {
      events.push({ kind: 'conflict.added', pr: snap.ref });
    }
    if (
      snap.mergeable === 'MERGEABLE' &&
      prev.lastMergeable === 'CONFLICTING'
    ) {
      events.push({ kind: 'conflict.cleared', pr: snap.ref });
    }
  }

  return { events, nextState: next };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
