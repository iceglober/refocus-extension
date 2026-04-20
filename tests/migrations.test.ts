import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COMMAND_PALETTE,
  DEFAULT_FLOATING_ICON,
  DEFAULT_GROUPS,
  DEFAULT_STALE,
  DEFAULT_SUSPEND,
} from '@/utils/defaults';
import { SETTINGS_MIGRATIONS } from '@/utils/migrations';

describe('SETTINGS_MIGRATIONS[2]', () => {
  it('fills v2 defaults and preserves prev fields', () => {
    const prev = {
      schemaVersion: 1,
      dedup: { globalEnabled: true, disabledHosts: [], rules: [], addressBarDedup: false },
    };
    const out = SETTINGS_MIGRATIONS[2]!(prev);
    expect(out.schemaVersion).toBe(2);
    expect(out.dedup).toEqual(prev.dedup);
    expect(out.suspend).toEqual(DEFAULT_SUSPEND);
    expect(out.stale).toEqual(DEFAULT_STALE);
    expect(out.groups).toEqual(DEFAULT_GROUPS);
    expect(out.floatingIcon).toEqual(DEFAULT_FLOATING_ICON);
  });

  it('leaves existing v2 fields untouched when already populated', () => {
    const existingSuspend = {
      enabled: true,
      idleMinutes: 60,
      exemptHosts: ['figma.com'],
      suspendPinned: true,
    };
    const out = SETTINGS_MIGRATIONS[2]!({
      schemaVersion: 1,
      suspend: existingSuspend,
    });
    expect(out.suspend).toEqual(existingSuspend);
  });
});

describe('SETTINGS_MIGRATIONS[3]', () => {
  it('bumps version and fills commandPalette default', () => {
    const prev = {
      schemaVersion: 2,
      dedup: { globalEnabled: true, disabledHosts: [], rules: [] },
      suspend: DEFAULT_SUSPEND,
    };
    const out = SETTINGS_MIGRATIONS[3]!(prev);
    expect(out.schemaVersion).toBe(3);
    expect(out.commandPalette).toEqual(DEFAULT_COMMAND_PALETTE);
    expect(out.dedup).toEqual(prev.dedup);
    expect(out.suspend).toEqual(prev.suspend);
  });

  it('preserves an existing commandPalette block', () => {
    const existing = {
      enabled: true,
      includeHistory: false,
      includeBookmarks: true,
      maxResults: 5,
    };
    const out = SETTINGS_MIGRATIONS[3]!({
      schemaVersion: 2,
      commandPalette: existing,
    });
    expect(out.commandPalette).toEqual(existing);
    expect(out.schemaVersion).toBe(3);
  });
});
