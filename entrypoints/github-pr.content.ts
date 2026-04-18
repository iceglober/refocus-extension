export default defineContentScript({
  matches: ['https://github.com/*/*/pull/*'],
  async main() {
    // Wait for GitHub's turbo frames to settle
    await new Promise((r) => setTimeout(r, 500));

    const header =
      document.querySelector('.gh-header-actions') ??
      document.querySelector('[class*="gh-header-actions"]');
    if (!header) return;
    if (document.getElementById('refocus-watch-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'refocus-watch-btn';
    btn.textContent = '★ Watch in Refocus';
    btn.className = 'btn btn-sm';
    btn.style.marginLeft = '6px';
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = '…';
      try {
        const resp = (await browser.runtime.sendMessage({
          kind: 'watch.resolvePrId',
          url: location.href,
        })) as { prId?: string } | undefined;
        const prId = resp?.prId;
        if (!prId) {
          btn.textContent = '★ Watch in Refocus';
          btn.disabled = false;
          alert(
            'Could not resolve PR id. Make sure you are signed in via the Refocus options page.',
          );
          return;
        }
        await browser.runtime.sendMessage({ kind: 'watch.addPr', prId });
        btn.textContent = '★ Watched';
      } catch (err) {
        btn.textContent = '★ Watch in Refocus';
        btn.disabled = false;
        alert(`Failed: ${String(err)}`);
      }
    });

    header.appendChild(btn);
  },
});
