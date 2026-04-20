import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaletteSnapshot } from '@/utils/commandPalette/types';

const tabActivity: Record<number, number> = {};

vi.mock('@/utils/storage', () => ({
  tabActivityStore: {
    getValue: async () => tabActivity,
  },
}));

type BrowserMock = {
  tabs: { query: ReturnType<typeof vi.fn> };
  history: { search: ReturnType<typeof vi.fn> };
  bookmarks: { getTree: ReturnType<typeof vi.fn> };
};

const mockBrowser: BrowserMock = {
  tabs: { query: vi.fn() },
  history: { search: vi.fn() },
  bookmarks: { getTree: vi.fn() },
};

(globalThis as unknown as { browser: BrowserMock }).browser = mockBrowser;

const { buildSnapshot, filterAndRank } = await import(
  '@/utils/commandPalette/search'
);

beforeEach(() => {
  mockBrowser.tabs.query.mockReset();
  mockBrowser.history.search.mockReset();
  mockBrowser.bookmarks.getTree.mockReset();
  for (const k of Object.keys(tabActivity)) {
    delete tabActivity[Number(k)];
  }
});

describe('buildSnapshot', () => {
  it('returns tabs-only when include flags are false', async () => {
    mockBrowser.tabs.query.mockResolvedValue([
      {
        id: 1,
        url: 'https://example.com/',
        title: 'Example',
        windowId: 10,
      },
    ]);
    const snap = await buildSnapshot(false, false);
    expect(snap.candidates).toHaveLength(1);
    expect(snap.candidates[0]?.source).toBe('tab');
    expect(mockBrowser.history.search).not.toHaveBeenCalled();
    expect(mockBrowser.bookmarks.getTree).not.toHaveBeenCalled();
  });

  it('dedupes same canonical URL across tab/bookmark/history with tab winning', async () => {
    mockBrowser.tabs.query.mockResolvedValue([
      { id: 1, url: 'https://github.com/', title: 'GitHub tab', windowId: 10 },
    ]);
    mockBrowser.bookmarks.getTree.mockResolvedValue([
      { children: [{ url: 'https://github.com/', title: 'GitHub bookmark' }] },
    ]);
    mockBrowser.history.search.mockResolvedValue([
      { url: 'https://github.com/', title: 'GitHub history' },
    ]);
    const snap = await buildSnapshot(true, true);
    expect(snap.candidates).toHaveLength(1);
    expect(snap.candidates[0]?.source).toBe('tab');
    expect(snap.candidates[0]?.title).toBe('GitHub tab');
  });

  it('degrades gracefully when history.search throws', async () => {
    mockBrowser.tabs.query.mockResolvedValue([
      { id: 1, url: 'https://example.com/', title: 'E', windowId: 10 },
    ]);
    mockBrowser.history.search.mockRejectedValue(
      new Error('permission denied'),
    );
    mockBrowser.bookmarks.getTree.mockResolvedValue([]);
    const snap = await buildSnapshot(true, true);
    expect(snap.candidates).toHaveLength(1);
    expect(snap.candidates[0]?.source).toBe('tab');
  });

  it('degrades gracefully when bookmarks.getTree throws', async () => {
    mockBrowser.tabs.query.mockResolvedValue([
      { id: 1, url: 'https://example.com/', title: 'E', windowId: 10 },
    ]);
    mockBrowser.bookmarks.getTree.mockRejectedValue(
      new Error('no permission'),
    );
    mockBrowser.history.search.mockResolvedValue([]);
    const snap = await buildSnapshot(true, true);
    expect(snap.candidates).toHaveLength(1);
    expect(snap.candidates[0]?.source).toBe('tab');
  });

  it('orders tabs by lastVisit desc for empty-query ranking', async () => {
    mockBrowser.tabs.query.mockResolvedValue([
      { id: 1, url: 'https://a.com/', title: 'A', windowId: 10 },
      { id: 2, url: 'https://b.com/', title: 'B', windowId: 10 },
    ]);
    tabActivity[1] = 100;
    tabActivity[2] = 999;
    const snap = await buildSnapshot(false, false);
    expect(snap.candidates[0]?.url).toBe('https://b.com/');
    expect(snap.candidates[1]?.url).toBe('https://a.com/');
  });
});

describe('filterAndRank', () => {
  const snap: PaletteSnapshot = {
    candidates: [
      {
        source: 'tab',
        url: 'https://github.com/',
        canonical: 'https://github.com/',
        title: 'GitHub',
      },
      {
        source: 'history',
        url: 'https://gitlab.com/',
        canonical: 'https://gitlab.com/',
        title: 'GitLab',
      },
      {
        source: 'bookmark',
        url: 'https://example.com/',
        canonical: 'https://example.com/',
        title: 'Example',
      },
    ],
  };

  it('empty query returns the first maxResults', () => {
    const out = filterAndRank('', snap, 2);
    expect(out).toHaveLength(2);
  });

  it('non-empty query filters out non-matches', () => {
    const out = filterAndRank('git', snap, 10);
    expect(out.length).toBeGreaterThanOrEqual(2);
    for (const c of out) {
      expect(c.title.toLowerCase()).toMatch(/git/);
    }
  });

  it('respects maxResults', () => {
    const out = filterAndRank('git', snap, 1);
    expect(out).toHaveLength(1);
  });

  it('tab source outranks history for equal fuzzy score', () => {
    const out = filterAndRank('git', snap, 10);
    const first = out[0];
    expect(first?.source).toBe('tab');
  });
});
