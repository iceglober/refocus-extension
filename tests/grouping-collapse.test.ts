import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { GroupSettings, TabActivityMap } from '@/utils/types';

const mockGroupsQuery = vi.fn();
const mockTabsQuery = vi.fn();
const mockGroupsUpdate = vi.fn().mockResolvedValue({});

vi.stubGlobal('chrome', {
  tabGroups: { query: mockGroupsQuery, update: mockGroupsUpdate },
  tabs: { query: mockTabsQuery },
});

const { collapseOldGroups } = await import('@/utils/grouping/collapse');

const settings: GroupSettings = {
  enabled: true,
  mode: 'domain',
  rules: [],
  collapseAfterMinutes: 30,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('collapseOldGroups', () => {
  it('collapses groups with no recent activity', async () => {
    const now = Date.now();
    mockGroupsQuery.mockResolvedValue([
      { id: 1, collapsed: false },
    ]);
    mockTabsQuery.mockResolvedValue([
      { id: 10, groupId: 1 },
      { id: 11, groupId: 1 },
    ]);

    const activity: TabActivityMap = {
      10: now - 60 * 60_000,
      11: now - 45 * 60_000,
    };

    await collapseOldGroups(settings, activity);
    expect(mockGroupsUpdate).toHaveBeenCalledWith(1, { collapsed: true });
  });

  it('does not collapse groups with recent activity', async () => {
    const now = Date.now();
    mockGroupsQuery.mockResolvedValue([
      { id: 1, collapsed: false },
    ]);
    mockTabsQuery.mockResolvedValue([
      { id: 10, groupId: 1 },
    ]);

    const activity: TabActivityMap = {
      10: now - 5 * 60_000,
    };

    await collapseOldGroups(settings, activity);
    expect(mockGroupsUpdate).not.toHaveBeenCalled();
  });

  it('skips already collapsed groups', async () => {
    mockGroupsQuery.mockResolvedValue([
      { id: 1, collapsed: true },
    ]);
    await collapseOldGroups(settings, {});
    expect(mockTabsQuery).not.toHaveBeenCalled();
  });

  it('does nothing when collapseAfterMinutes is 0', async () => {
    await collapseOldGroups({ ...settings, collapseAfterMinutes: 0 }, {});
    expect(mockGroupsQuery).not.toHaveBeenCalled();
  });
});
