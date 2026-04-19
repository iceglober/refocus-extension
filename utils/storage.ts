import { storage } from 'wxt/storage';
import {
  DEFAULT_FLOATING_ICON,
  DEFAULT_GROUPS,
  DEFAULT_SETTINGS,
  DEFAULT_STALE,
  DEFAULT_SUSPEND,
} from './defaults';
import type {
  Auth,
  PrStateMap,
  Settings,
  StaleNotifiedMap,
  TabActivityMap,
} from './types';

export const settingsStore = storage.defineItem<Settings>('sync:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 2,
  migrations: {
    2: (prev: Record<string, unknown>) => ({
      ...prev,
      schemaVersion: 2,
      suspend: prev.suspend ?? DEFAULT_SUSPEND,
      stale: prev.stale ?? DEFAULT_STALE,
      groups: prev.groups ?? DEFAULT_GROUPS,
      floatingIcon: prev.floatingIcon ?? DEFAULT_FLOATING_ICON,
    }),
  },
});

export const authStore = storage.defineItem<Auth>('local:auth', {
  fallback: { mode: 'none' },
});

export const prStateStore = storage.defineItem<PrStateMap>('local:prState', {
  fallback: {},
});

export const tabActivityStore = storage.defineItem<TabActivityMap>(
  'local:tabActivity',
  { fallback: {} },
);

export const staleNotifiedStore = storage.defineItem<StaleNotifiedMap>(
  'local:staleNotified',
  { fallback: {} },
);

export async function updateSettings(
  mutator: (settings: Settings) => void,
): Promise<void> {
  const settings = await settingsStore.getValue();
  const next = structuredClone(settings);
  mutator(next);
  await settingsStore.setValue(next);
}
