import {
  DEFAULT_COMMAND_PALETTE,
  DEFAULT_FLOATING_ICON,
  DEFAULT_GROUPS,
  DEFAULT_STALE,
  DEFAULT_SUSPEND,
} from './defaults';

export const SETTINGS_MIGRATIONS: Record<
  number,
  (prev: Record<string, unknown>) => Record<string, unknown>
> = {
  2: (prev) => ({
    ...prev,
    schemaVersion: 2,
    suspend: prev.suspend ?? DEFAULT_SUSPEND,
    stale: prev.stale ?? DEFAULT_STALE,
    groups: prev.groups ?? DEFAULT_GROUPS,
    floatingIcon: prev.floatingIcon ?? DEFAULT_FLOATING_ICON,
  }),
  3: (prev) => ({
    ...prev,
    schemaVersion: 3,
    commandPalette: prev.commandPalette ?? DEFAULT_COMMAND_PALETTE,
  }),
};
