import { settingsStore } from '@/utils/storage';
import { renderAccountPane } from './panes/account';
import { renderHostsPane } from './panes/hosts';
import { renderImportExportPane } from './panes/importExport';
import { renderRulesPane } from './panes/rules';
import { renderWatchNotificationsPane } from './panes/watchNotifications';
import { renderWatchTargetsPane } from './panes/watchTargets';

const PANE_IDS = [
  'rules',
  'hosts',
  'watch-targets',
  'watch-notifications',
  'account',
  'import-export',
] as const;

function setupTabs() {
  const buttons = document.querySelectorAll<HTMLButtonElement>('#tabs button');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab!;
      buttons.forEach((b) => b.classList.toggle('active', b === btn));
      PANE_IDS.forEach((id) => {
        const el = document.getElementById(`pane-${id}`)!;
        el.classList.toggle('hidden', id !== tab);
      });
    });
  });
}

async function render() {
  const settings = await settingsStore.getValue();
  renderRulesPane(document.getElementById('pane-rules')!, settings);
  renderHostsPane(document.getElementById('pane-hosts')!, settings);
  renderWatchTargetsPane(
    document.getElementById('pane-watch-targets')!,
    settings,
  );
  renderWatchNotificationsPane(
    document.getElementById('pane-watch-notifications')!,
    settings,
  );
  await renderAccountPane(document.getElementById('pane-account')!, settings);
  renderImportExportPane(
    document.getElementById('pane-import-export')!,
    settings,
  );
}

setupTabs();
render();
settingsStore.watch(() => {
  render();
});
