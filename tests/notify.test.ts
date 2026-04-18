import { describe, expect, it, vi } from 'vitest';

vi.mock('wxt/storage', () => ({
  storage: {
    defineItem: () => ({
      getValue: async () => ({}),
      setValue: async () => {},
      watch: () => () => {},
    }),
  },
}));

const { formatTitle } = await import('@/utils/watch/notify');
import type { PrEvent, PrRef } from '@/utils/types';

const ref: PrRef = {
  id: 'PR_1',
  number: 42,
  title: 'T',
  url: 'https://github.com/o/r/pull/42',
  repo: 'o/r',
};

const cases: Array<[PrEvent, string]> = [
  [{ kind: 'checks.passed', pr: ref, sha: 'a' }, '✅ Checks passed'],
  [{ kind: 'checks.failed', pr: ref, sha: 'a', failing: ['x'] }, '❌ Checks failed'],
  [{ kind: 'checks.pending', pr: ref, sha: 'a' }, '⏳ Checks running'],
  [{ kind: 'merged', pr: ref }, '🎉 Merged'],
  [{ kind: 'closed', pr: ref }, '🚫 Closed'],
  [{ kind: 'conflict.added', pr: ref }, '⚠️ Conflicts'],
  [{ kind: 'conflict.cleared', pr: ref }, '✅ Conflicts resolved'],
  [
    { kind: 'mention', pr: ref, commentId: 'c', commentUrl: 'u', author: 'alice' },
    '💬 alice mentioned you',
  ],
  [
    { kind: 'review.submitted', pr: ref, reviewId: 'r', reviewer: 'bob', state: 'APPROVED' },
    '✅ bob approved',
  ],
  [
    {
      kind: 'review.submitted',
      pr: ref,
      reviewId: 'r',
      reviewer: 'bob',
      state: 'CHANGES_REQUESTED',
    },
    '❌ bob requested changes',
  ],
  [
    { kind: 'review.submitted', pr: ref, reviewId: 'r', reviewer: 'bob', state: 'COMMENTED' },
    '💬 bob commented',
  ],
];

describe('formatTitle', () => {
  it.each(cases)('%o → %s', (event, expected) => {
    expect(formatTitle(event)).toBe(expected);
  });
});
