import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mock `browser` global before importing modules that use it
// ============================================================================

const tabs = {
  query: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  onCreated: { addListener: vi.fn() },
};
const windows = { update: vi.fn() };
// @ts-expect-error test env
globalThis.browser = { tabs, windows };

const mockSettings = {
  schemaVersion: 1 as const,
  dedup: {
    globalEnabled: true,
    disabledHosts: [] as string[],
    rules: [
      {
        id: 'r',
        name: 'r',
        enabled: true,
        match: { hostGlob: 'github.com' },
        pipeline: [{ kind: 'builtin' as const, id: 'github-pr' as const }],
        scope: 'profile' as const,
        priority: 100,
      },
    ],
    debug: false,
    addressBarDedup: false,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  watch: {} as any,
};

vi.mock('wxt/storage', () => ({
  storage: {
    defineItem: () => ({
      getValue: async () => mockSettings,
      setValue: async () => {},
      watch: () => () => {},
    }),
  },
}));

// ============================================================================

const { handleNewTab } = await import('@/utils/dedup');
const { pendingDedup } = await import('@/utils/dedup/pendingClaim');

beforeEach(() => {
  vi.clearAllMocks();
  pendingDedup._clear();
});

describe('handleNewTab', () => {
  it('focuses existing tab and removes new tab when canonical matches', async () => {
    tabs.query.mockResolvedValueOnce([
      {
        id: 1,
        windowId: 10,
        url: 'https://github.com/a/b/pull/5/files',
        incognito: false,
      },
    ]);
    await handleNewTab({
      id: 2,
      windowId: 11,
      pendingUrl: 'https://github.com/a/b/pull/5',
      incognito: false,
      pinned: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(tabs.update).toHaveBeenCalledWith(1, { active: true });
    expect(windows.update).toHaveBeenCalledWith(10, {
      focused: true,
      state: 'normal',
    });
    expect(tabs.remove).toHaveBeenCalledWith(2);
  });

  it('does nothing when no matching rule', async () => {
    await handleNewTab({
      id: 2,
      windowId: 11,
      pendingUrl: 'https://example.com/',
      incognito: false,
      pinned: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect(tabs.remove).not.toHaveBeenCalled();
  });

  it('skips pinned new tabs', async () => {
    await handleNewTab({
      id: 2,
      windowId: 11,
      pendingUrl: 'https://github.com/a/b/pull/5',
      incognito: false,
      pinned: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect(tabs.query).not.toHaveBeenCalled();
  });

  it('never matches across incognito boundary', async () => {
    tabs.query.mockResolvedValueOnce([
      {
        id: 1,
        windowId: 10,
        url: 'https://github.com/a/b/pull/5',
        incognito: true,
      },
    ]);
    await handleNewTab({
      id: 2,
      windowId: 11,
      pendingUrl: 'https://github.com/a/b/pull/5',
      incognito: false,
      pinned: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect(tabs.remove).not.toHaveBeenCalled();
  });

  it('skips chrome:// URLs', async () => {
    await handleNewTab({
      id: 2,
      pendingUrl: 'chrome://settings/',
      incognito: false,
      pinned: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect(tabs.query).not.toHaveBeenCalled();
  });

  it('second rapid-fire call for same canonical is a no-op', async () => {
    tabs.query.mockResolvedValue([
      {
        id: 1,
        windowId: 10,
        url: 'https://github.com/a/b/pull/5',
        incognito: false,
      },
    ]);
    const a = handleNewTab({
      id: 2,
      windowId: 11,
      pendingUrl: 'https://github.com/a/b/pull/5',
      incognito: false,
      pinned: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const b = handleNewTab({
      id: 3,
      windowId: 11,
      pendingUrl: 'https://github.com/a/b/pull/5',
      incognito: false,
      pinned: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    await Promise.all([a, b]);
    // Only one remove should have happened (for tab 2); tab 3 early-returned on claim.
    expect(tabs.remove).toHaveBeenCalledTimes(1);
    expect(tabs.remove).toHaveBeenCalledWith(2);
  });

  it('skips disabled hosts before rule lookup', async () => {
    const prevHosts = mockSettings.dedup.disabledHosts;
    mockSettings.dedup.disabledHosts = ['github.com'];
    try {
      await handleNewTab({
        id: 2,
        windowId: 11,
        pendingUrl: 'https://github.com/a/b/pull/5',
        incognito: false,
        pinned: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      expect(tabs.query).not.toHaveBeenCalled();
    } finally {
      mockSettings.dedup.disabledHosts = prevHosts;
    }
  });
});
