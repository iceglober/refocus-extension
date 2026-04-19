import { test, expect } from './fixtures';

test('popup page renders and exposes global toggle', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(page.locator('h1')).toHaveText('Refocus');
  await expect(page.locator('#global')).toBeChecked();
  await expect(page.locator('#watch')).not.toBeChecked();
});

test('toggling globalEnabled from the popup updates storage', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await page.locator('#global').uncheck();

  // Reload — the toggle state should be persisted.
  await page.reload();
  await expect(page.locator('#global')).not.toBeChecked();
});
