import { tabActivityStore } from '../storage';
import type { TabActivityMap } from '../types';

export async function recordActivity(tabId: number): Promise<void> {
  const map = await tabActivityStore.getValue();
  map[tabId] = Date.now();
  await tabActivityStore.setValue(map);
}

export async function removeActivity(tabId: number): Promise<void> {
  const map = await tabActivityStore.getValue();
  delete map[tabId];
  await tabActivityStore.setValue(map);
}

export async function getActivity(): Promise<TabActivityMap> {
  return tabActivityStore.getValue();
}
