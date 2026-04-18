import { registerDedupListeners } from '@/utils/dedup';
import { registerAddressBarDedup } from '@/utils/dedup/addressBar';
import { registerWatchListeners } from '@/utils/watch';
import { registerWatchMessages } from '@/utils/watch/messages';
import { settingsStore } from '@/utils/storage';

export default defineBackground(() => {
  console.log('[refocus] background booted');

  registerDedupListeners();
  registerWatchMessages();

  registerWatchListeners().catch((err) => console.error('[refocus:watch]', err));

  (async () => {
    const settings = await settingsStore.getValue();
    if (settings.dedup.addressBarDedup) registerAddressBarDedup();
  })().catch((err) => console.error('[refocus:addressBar]', err));
});
