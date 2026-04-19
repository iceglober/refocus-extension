import { test, expect } from './fixtures';

test('background service worker responds to watch.resolvePrId message', async ({
  context,
  extensionId,
  background,
}) => {
  // Evaluate from inside an extension page so browser.runtime is available.
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  const resp = await page.evaluate(async () => {
    return await chrome.runtime.sendMessage({
      kind: 'watch.resolvePrId',
      url: 'https://github.com/foo/bar/pull/1',
    });
  });

  // Unauthenticated → resolvePrIdFromUrl returns null; message handler wraps it.
  expect(resp).toEqual({ prId: null });
  expect(background.url()).toContain('background.js');
});

test('adding a PR to the explicit watch list from content-script path persists', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  await page.evaluate(async () => {
    await chrome.runtime.sendMessage({ kind: 'watch.addPr', prId: 'PR_TEST_1' });
  });

  await page.locator('#tabs button[data-tab="watch-targets"]').click();
  await expect(page.locator('#pane-watch-targets .list code')).toContainText(
    'PR_TEST_1',
  );
});
