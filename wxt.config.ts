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
    ],
    host_permissions: ['https://api.github.com/*'],
    optional_host_permissions: ['https://*/*'],
    minimum_chrome_version: '110',
  },
  srcDir: '.',
});
