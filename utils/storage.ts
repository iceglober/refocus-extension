import { storage } from 'wxt/storage';
import { DEFAULT_SETTINGS } from './defaults';
import type { Auth, PrStateMap, Settings } from './types';

export const settingsStore = storage.defineItem<Settings>('sync:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 1,
});

export const authStore = storage.defineItem<Auth>('local:auth', {
  fallback: { mode: 'none' },
});

export const prStateStore = storage.defineItem<PrStateMap>('local:prState', {
  fallback: {},
});

export async function updateSettings(
  mutator: (settings: Settings) => void,
): Promise<void> {
  const settings = await settingsStore.getValue();
  const next = structuredClone(settings);
  mutator(next);
  await settingsStore.setValue(next);
}
