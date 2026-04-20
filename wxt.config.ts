import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Refocus',
    description: 'Reuse existing tabs and get GitHub PR notifications.',
    version: '0.1.0',
    permissions: [
      'tabs',
      'storage',
      'alarms',
      'notifications',
      'identity',
      'webNavigation',
      'tabGroups',
      'sidePanel',
      'history',
      'bookmarks',
    ],
    host_permissions: ['https://api.github.com/*'],
    optional_host_permissions: ['https://*/*'],
    minimum_chrome_version: '110',
    commands: {
      'open-command-palette': {
        suggested_key: {
          default: 'Ctrl+Period',
          mac: 'Command+Period',
        },
        description: 'Open Refocus command palette',
      },
    },
  },
  srcDir: '.',
});
