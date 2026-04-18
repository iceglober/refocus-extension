import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Refocus',
    description: 'Reuse existing tabs and get GitHub PR notifications.',
    version: '0.0.1',
    permissions: [
      'tabs',
      'storage',
      'alarms',
      'notifications',
      'identity',
      'webNavigation',
    ],
    host_permissions: ['https://api.github.com/*'],
    optional_host_permissions: ['https://*/*'],
    minimum_chrome_version: '110',
  },
  srcDir: '.',
});
