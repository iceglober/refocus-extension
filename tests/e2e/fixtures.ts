import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_PATH = resolve(__dirname, '../../.output/chrome-mv3');

if (!existsSync(EXT_PATH)) {
  throw new Error(
    `Extension not built at ${EXT_PATH} — run \`pnpm build\` before e2e tests.`,
  );
}

type Fixtures = {
  context: BrowserContext;
  extensionId: string;
  background: Worker;
};

export const test = base.extend<Fixtures>({
  // oxlint-disable-next-line no-empty-pattern -- Playwright requires object destructure
  context: async ({}, use) => {
    const userDataDir = mkdtempSync(join(tmpdir(), 'refocus-e2e-'));
    // MV3 extension service workers don't reliably spawn in headless mode,
    // so run headful under xvfb (CI) or a real display (local).
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${EXT_PATH}`,
        `--load-extension=${EXT_PATH}`,
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    await use(context);
    await context.close();
  },

  background: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 20_000 });
    await use(sw);
  },

  extensionId: async ({ background }, use) => {
    const id = new URL(background.url()).host;
    await use(id);
  },
});

export { expect } from '@playwright/test';
