import { settingsStore } from '@/utils/storage';
import type { Settings } from '@/utils/types';
import { renderAccountPane } from '../options/panes/account';
import { renderGroupsPane } from '../options/panes/groups';
import { renderHostsPane } from '../options/panes/hosts';
import { renderImportExportPane } from '../options/panes/importExport';
import { renderRulesPane } from '../options/panes/rules';
import { renderStalePane } from '../options/panes/stale';
import { renderSuspendPane } from '../options/panes/suspend';
import { renderWatchNotificationsPane } from '../options/panes/watchNotifications';
import { renderWatchTargetsPane } from '../options/panes/watchTargets';

type Renderer = (el: HTMLElement, s: Settings) => void | Promise<void>;

const PANES: Record<string, Renderer> = {
  rules: renderRulesPane,
  hosts: renderHostsPane,
  'watch-targets': renderWatchTargetsPane,
  'watch-notifications': renderWatchNotificationsPane,
  suspend: renderSuspendPane,
  stale: renderStalePane,
  groups: renderGroupsPane,
  account: renderAccountPane,
  'import-export': renderImportExportPane,
};

function setupTabs() {
  const buttons = document.querySelectorAll<HTMLButtonElement>('#tabs button');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab!;
      buttons.forEach((b) => b.classList.toggle('active', b === btn));
      for (const id of Object.keys(PANES)) {
        document.getElementById(`pane-${id}`)!.classList.toggle('hidden', id !== tab);
      }
    });
  });
}

async function render() {
  const settings = await settingsStore.getValue();
  for (const [id, renderer] of Object.entries(PANES)) {
    await renderer(document.getElementById(`pane-${id}`)!, settings);
  }
}

setupTabs();
render();
settingsStore.watch(() => render());
