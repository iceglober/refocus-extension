import { test, expect } from './fixtures';

test('extension loads and registers a service worker', async ({ background, extensionId }) => {
  expect(background).toBeDefined();
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

test('options page renders with all panes', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  await expect(page.locator('header h1')).toHaveText('Refocus');
  await expect(page.locator('#tabs button')).toHaveCount(6);
  await expect(page.locator('#pane-rules h2').first()).toHaveText('Dedup Rules');
});

test('rules pane lists default rules', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  const rows = page.locator('#pane-rules tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(rows).toContainText(['GitHub Pull Requests', 'GitHub Issues']);
});

test('switching tabs shows the target pane', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  await page.locator('#tabs button[data-tab="hosts"]').click();
  await expect(page.locator('#pane-hosts')).not.toHaveClass(/hidden/);
  await expect(page.locator('#pane-rules')).toHaveClass(/hidden/);
  await expect(page.locator('#pane-hosts h2').first()).toHaveText('Disabled Hosts');
});

test('adding a disabled host persists in storage', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.locator('#tabs button[data-tab="hosts"]').click();

  await page.fill('#host-input', 'figma.com');
  await page.click('#add-host');

  await expect(page.locator('#pane-hosts .list code').first()).toHaveText('figma.com');

  // Reopen options — hosts should still show figma.com (sync storage persisted).
  const page2 = await context.newPage();
  await page2.goto(`chrome-extension://${extensionId}/options.html`);
  await page2.locator('#tabs button[data-tab="hosts"]').click();
  await expect(page2.locator('#pane-hosts .list code').first()).toHaveText('figma.com');
});
