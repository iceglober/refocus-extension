import { storage } from 'wxt/storage';
import { DEFAULT_SETTINGS } from './defaults';
import { SETTINGS_MIGRATIONS } from './migrations';
import type {
  Auth,
  PrStateMap,
  Settings,
  StaleNotifiedMap,
  TabActivityMap,
} from './types';

export const settingsStore = storage.defineItem<Settings>('sync:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 3,
  migrations: SETTINGS_MIGRATIONS,
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
