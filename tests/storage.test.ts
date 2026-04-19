import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@/utils/defaults';
import type { Settings } from '@/utils/types';

let current: Settings = structuredClone(DEFAULT_SETTINGS);
const setValue = vi.fn(async (v: Settings) => {
  current = v;
});

vi.mock('wxt/storage', () => ({
  storage: {
    defineItem: () => ({
      getValue: async () => current,
      setValue,
      watch: () => () => {},
    }),
  },
}));

const { updateSettings } = await import('@/utils/storage');

beforeEach(() => {
  current = structuredClone(DEFAULT_SETTINGS);
  setValue.mockClear();
});

describe('updateSettings', () => {
  it('applies the mutator and persists the result', async () => {
    await updateSettings((s) => {
      s.dedup.globalEnabled = false;
    });
    expect(setValue).toHaveBeenCalledTimes(1);
    expect(current.dedup.globalEnabled).toBe(false);
  });

  it('does not mutate the original (writes a deep clone)', async () => {
    const before = current.dedup.rules;
    await updateSettings((s) => {
      s.dedup.rules.push({
        id: 'new',
        name: 'new',
        enabled: true,
        match: { hostGlob: '*' },
        pipeline: [{ kind: 'identity' }],
        scope: 'profile',
        priority: 1,
      });
    });
    expect(before).not.toBe(current.dedup.rules);
    expect(current.dedup.rules.find((r) => r.id === 'new')).toBeDefined();
  });

  it('handles async mutators via Promise.resolve chain (mutator is sync by contract but setValue is awaited)', async () => {
    const p = updateSettings((s) => {
      s.watch.enabled = true;
    });
    expect(current.watch.enabled).toBe(false); // not yet persisted (awaits getValue)
    await p;
    expect(current.watch.enabled).toBe(true);
  });
});
