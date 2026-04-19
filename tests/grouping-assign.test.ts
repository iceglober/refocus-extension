import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { GroupSettings } from '@/utils/types';

const mockGroup = vi.fn().mockResolvedValue(1);
const mockGroupsQuery = vi.fn().mockResolvedValue([]);
const mockGroupsUpdate = vi.fn().mockResolvedValue({});

vi.stubGlobal('chrome', {
  tabs: { group: mockGroup },
  tabGroups: { query: mockGroupsQuery, update: mockGroupsUpdate },
});

const { assignTabToGroup } = await import('@/utils/grouping/assign');

const domainSettings: GroupSettings = {
  enabled: true,
  mode: 'domain',
  rules: [],
  collapseAfterMinutes: 0,
};

const ruleSettings: GroupSettings = {
  enabled: true,
  mode: 'rules',
  rules: [
    {
      id: 'r1',
      name: 'GitHub',
      enabled: true,
      hostGlob: 'github.com',
      groupTitle: 'GitHub',
      color: 'green',
    },
  ],
  collapseAfterMinutes: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGroupsQuery.mockResolvedValue([]);
  mockGroup.mockResolvedValue(1);
});

describe('assignTabToGroup — domain mode', () => {
  it('creates a group titled by hostname', async () => {
    await assignTabToGroup(1, 'https://github.com/pulls', 10, -1, domainSettings);
    expect(mockGroup).toHaveBeenCalledWith({
      tabIds: [1],
      createProperties: { windowId: 10 },
    });
    expect(mockGroupsUpdate).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ title: 'github.com' }),
    );
  });

  it('reuses existing group with same title', async () => {
    mockGroupsQuery.mockResolvedValue([{ id: 42, title: 'github.com' }]);
    await assignTabToGroup(2, 'https://github.com/issues', 10, -1, domainSettings);
    expect(mockGroup).toHaveBeenCalledWith({
      tabIds: [2],
      groupId: 42,
    });
    expect(mockGroupsUpdate).not.toHaveBeenCalled();
  });

  it('skips if tab is already in the correct group', async () => {
    mockGroupsQuery.mockResolvedValue([{ id: 42, title: 'github.com' }]);
    await assignTabToGroup(2, 'https://github.com/', 10, 42, domainSettings);
    expect(mockGroup).not.toHaveBeenCalled();
  });

  it('skips unparseable URLs', async () => {
    await assignTabToGroup(1, 'not a url', 10, -1, domainSettings);
    expect(mockGroup).not.toHaveBeenCalled();
  });
});

describe('assignTabToGroup — rules mode', () => {
  it('matches rule and creates group with configured title and color', async () => {
    await assignTabToGroup(1, 'https://github.com/pr', 10, -1, ruleSettings);
    expect(mockGroupsUpdate).toHaveBeenCalledWith(1, {
      title: 'GitHub',
      color: 'green',
    });
  });

  it('does nothing when no rule matches', async () => {
    await assignTabToGroup(1, 'https://example.com/', 10, -1, ruleSettings);
    expect(mockGroup).not.toHaveBeenCalled();
  });
});
