import { createShadowRootUi } from 'wxt/client';

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="24" height="24">
  <circle cx="16" cy="16" r="14" fill="#2f6cff" />
  <text x="16" y="22" text-anchor="middle" font-size="18" font-weight="bold" fill="#fff" font-family="system-ui">R</text>
</svg>`;

export default defineContentScript({
  matches: ['https://*/*'],
  async main(ctx) {
    let settings: { floatingIcon?: { enabled: boolean } } | undefined;
    try {
      settings = (await browser.runtime.sendMessage({
        kind: 'settings.get',
      })) as typeof settings;
    } catch {
      return;
    }
    if (!settings?.floatingIcon?.enabled) return;

    const ui = await createShadowRootUi(ctx, {
      name: 'refocus-fab',
      position: 'overlay',
      zIndex: 2147483646,
      onMount(container) {
        const fab = document.createElement('div');

        const savedY = localStorage.getItem('refocus-fab-y');
        const topPx = savedY ? `${savedY}px` : '50%';

        fab.innerHTML = ICON_SVG;
        fab.setAttribute(
          'style',
          `position:fixed;right:12px;top:${topPx};width:40px;height:40px;border-radius:50%;background:#2f6cff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px #0004;transition:transform 0.15s;z-index:2147483646;user-select:none;`,
        );

        fab.addEventListener('mouseenter', () => {
          fab.style.transform = 'scale(1.1)';
        });
        fab.addEventListener('mouseleave', () => {
          fab.style.transform = '';
        });

        let dragging = false;
        let startY = 0;
        let startTop = 0;

        fab.addEventListener('mousedown', (e) => {
          dragging = false;
          startY = e.clientY;
          startTop = fab.getBoundingClientRect().top;
          e.preventDefault();

          const onMove = (ev: MouseEvent) => {
            const dy = ev.clientY - startY;
            if (Math.abs(dy) > 3) dragging = true;
            const newTop = Math.max(
              0,
              Math.min(window.innerHeight - 40, startTop + dy),
            );
            fab.style.top = `${newTop}px`;
          };

          const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            localStorage.setItem(
              'refocus-fab-y',
              String(fab.getBoundingClientRect().top),
            );
            if (!dragging) {
              browser.runtime.sendMessage({ kind: 'sidePanel.open' });
            }
          };

          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });

        container.appendChild(fab);
      },
    });

    ui.mount();
  },
});
