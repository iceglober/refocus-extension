# Command Palette

## Goal

Add a Raycast/Spotlight-style in-browser command palette. User presses a keyboard shortcut (default `Ctrl+Period` / `Cmd+Period`), an overlay appears on the current page, user types a query, fuzzy-matched results from open tabs + browser history + bookmarks are shown, Enter either switches to an existing matching tab or opens the destination in a new tab. Feature is **opt-in**: disabled by default, optional `history`/`bookmarks` permissions requested at runtime when user enables it.

## Constraints

- **No new runtime dependencies.** Hand-roll the fuzzy matcher — plain TS, ~50 lines. Avoid fuzzysort/fuse.js bundle bloat on every https page.
- **Opt-in, optional permissions.** `history` and `bookmarks` go in `optional_permissions`, requested via `browser.permissions.request()` when the user toggles the feature on. Never request on install. Palette content script is injected into all https pages but is inert until (a) feature is enabled AND (b) permissions granted.
- **Palette UI code must run on unreachable pages too.** When the active tab's content script is unreachable (chrome://, Web Store, PDF viewer, file://), background falls back to opening the palette in a dedicated popup window (`chrome.windows.create` with `type: 'popup'`, sized ~560×420).
- **Follow existing codebase patterns.** Plain TS. All attacker-controlled strings (tab titles, URLs from history/bookmarks) must be inserted via `element.textContent = str` — NEVER via `innerHTML` interpolation. Static scaffolds (containers, classes) may use `innerHTML`. `utils/html.ts#escapeHtml` is not used in palette rendering; `textContent` replaces it. Shadow DOM via WXT's `createShadowRootUi` for the in-page overlay, message-based content↔background coordination with a `kind` discriminator.
- **Snapshot data on palette open**, filter/rank in-memory on each keystroke. No per-keystroke async queries.
- **URL canonicalization for dedup** uses a new shared helper (strip fragment, strip common tracking params, lowercase host) that runs unconditionally — does NOT depend on the user having a dedup `Rule` configured.
- **Reuse existing primitives:** `utils/dedup/focus.ts`'s `focus(tab)` for activation, `settingsStore` + versioned migration for settings, `utils/html.ts` helpers if needed for any HTML construction.
- **Schema bump to version 3.** Widen `Settings.schemaVersion` literal to `3` (drop `2`). Existing v2 migration in `utils/storage.ts` keeps its `schemaVersion: 2` line unchanged (its output gets overwritten by the v3 migration, which WXT chains automatically). Add v3 migration that spreads prev, sets `schemaVersion: 3`, and fills `commandPalette: prev.commandPalette ?? DEFAULT_COMMAND_PALETTE`. To make the migration function directly unit-testable, **extract the `migrations` map from `utils/storage.ts` into a new `utils/migrations.ts` file**, import it in `storage.ts`, and import it in `tests/storage.test.ts`.
- **Shortcut defaults:** `Ctrl+Period` on all platforms (Firefox auto-maps to Cmd on mac; Chrome needs `"mac": "Command+Period"` explicit entry). Users can rebind via `chrome://extensions/shortcuts`.
- **No double-fire.** Keyboard delivery is via `browser.commands.onCommand` only (background → send message to active tab OR open popup on failure). No content-script-local keydown listener — simpler, no dedup tokens needed. Accept ~50-300ms cold-start latency on first press after service worker suspend. Known limitation: on pages that capture keyboard (Google Docs, some editors), `browser.commands` may not fire — documented in Options pane.
- **Popup-fallback detection.** Background decides which path to take BEFORE attempting to send. Two-tier check: (1) URL heuristic — if active tab URL starts with any of `chrome://`, `chrome-extension://`, `edge://`, `about:`, `file://`, `view-source:`, or is `https://chrome.google.com/webstore`, `https://chromewebstore.google.com`, go straight to popup; (2) otherwise attempt `browser.tabs.sendMessage(tabId, { kind: 'palette.open' })` wrapped in `Promise.race` with a 300ms timeout. On timeout or rejection with "Could not establish connection", fall back to popup. Both tiers share one `openPalettePopup()` helper.
- **Popup singleton.** Background tracks `palettePopupWindowId` in-memory. On repeat invocation while popup exists, calls `browser.windows.update(id, { focused: true })` instead of creating a new one. Listens to `browser.windows.onRemoved` to clear the tracked id. On mac, after `chrome.windows.create`, also call `browser.windows.update(id, { focused: true })` to force focus.
- **Revoked-permissions handling.** Background registers `browser.permissions.onRemoved` listener. If `history` or `bookmarks` is removed while `commandPalette.enabled === true`, background sets `commandPalette.enabled = false` via `updateSettings` (prevents a shortcut press from throwing). `buildSnapshot` also defensively wraps each of `browser.history.search` and `browser.bookmarks.getTree` in a try/catch that returns an empty list on any error — so palette degrades to tabs-only rather than throwing if perms are missing for any reason (e.g., hand-edited storage, revocation race).

## Acceptance criteria

- [x] New `commandPalette` settings block added to `Settings` type with `enabled`, `includeHistory`, `includeBookmarks`, `maxResults`. Defaults: all features on when enabled toggled, `maxResults: 8`.
- [x] `schemaVersion` bumped to `3`; migration from 2 → 3 adds `commandPalette: DEFAULT_COMMAND_PALETTE` without clobbering existing settings. Existing settings migration test updated.
- [x] `optional_permissions: ['history', 'bookmarks']` added to `wxt.config.ts` manifest.
- [x] `commands` entry added to `wxt.config.ts` manifest for `open-command-palette` with suggested_key `Ctrl+Period` (default) + `Command+Period` (mac).
- [x] `utils/commandPalette/canonicalize.ts`: `paletteCanonicalize(url: string): string` — lowercases host, strips fragment, strips query params matching `/^(utm_|mc_|_ga$|fbclid$|gclid$|igshid$|yclid$|vero_id$|mkt_tok$)/i`. **Does NOT strip `ref` or `ref_src`** — those carry meaning on GitHub (`?ref=main` = git ref) and similar. Preserves remaining query params and path. Normalizes trailing slash on root path only. Returns input unchanged on parse failure. Unit tested.
- [x] `utils/commandPalette/fuzzy.ts`: `fuzzyScore(query: string, target: string): number | null` — returns null if no subsequence match, else a score in [0, 1] with word-start bonus + consecutive-match bonus + shorter-target bonus. Unit tested with at least 6 cases (empty query, exact match, subsequence, no match, word-start vs mid-word, multiple candidates ranked correctly).
- [x] `utils/commandPalette/search.ts`: `buildSnapshot(includeHistory, includeBookmarks)` → fetches tabs (always), plus `tabActivityStore.getValue()` for recency, plus history (if `includeHistory`, wrapped in try/catch → `[]` on throw), plus bookmarks (if `includeBookmarks`, wrapped in try/catch → `[]` on throw). Attaches `lastVisit` on each tab candidate from the activity map. Dedupes by canonical URL with tab > bookmark > history precedence (first-wins in `Map<canonical, PaletteCandidate>`). `filterAndRank(query, snapshot, maxResults)` → returns top N. Empty query: returns tabs sorted by `lastVisit` desc, then bookmarks by `dateAdded` desc, then history by `lastVisitTime` desc, capped at `maxResults`. Non-empty query: `fuzzyScore` against `title + ' ' + url`, filter nulls, rank by `score * sourceWeight + recencyBoost`. Unit tested.
- [x] `utils/commandPalette/activate.ts`: `activatePaletteCandidate(candidate)` — if candidate is a tab, calls `focus(tab)`; else calls `browser.tabs.create({ url, active: true })`. `activateQueryAsUrl(query)` — matches `/^[a-z0-9-]+(\.[a-z]{2,})+(\/.*)?$/i`; returns true + opens `https://<query>` if match, else returns false. Unit tested.
- [x] `entrypoints/command-palette.content.ts`: new content script. Matches `https://*/*` only (consistent with the extension's existing `optional_host_permissions: ['https://*/*']`; we do not add `http://`). **The `onMessage` listener is registered synchronously at the top of `main(ctx)`, before any `await`** — so no shortcut-press is ever lost to a late listener registration. Listener handles `kind: 'palette.open'`: on first call, checks `settings.commandPalette.enabled` (via `settings.get`); if disabled or no perms, silently returns. Uses `createShadowRootUi` to mount palette overlay. Registers `ctx.onInvalidated` to unmount the palette when the content script context is invalidated (e.g., page navigates, extension reloads).
- [x] `entrypoints/command-palette-popup/`: new HTML + TS entrypoint that renders the same palette UI in a dedicated popup window. Used as fallback when content script can't be reached. Shares UI code with the content script via a single `renderPalette(root, services)` function in `utils/commandPalette/ui.ts`.
- [x] `entrypoints/background.ts`: new `kind: 'palette.snapshot.request'` handler (returns `buildSnapshot(...)`). New `kind: 'palette.activate'` handler (dispatches to `activateCandidate` or `activateQueryAsUrl`). New top-level `browser.commands.onCommand` listener for `open-command-palette`: if settings.commandPalette.enabled is false, return. Otherwise run two-tier popup-fallback: (1) URL-heuristic check on the active tab URL for reserved schemes / Web Store hosts → if matches, open popup. (2) Otherwise `Promise.race` between `browser.tabs.sendMessage(tabId, { kind: 'palette.open' })` and a 300ms timeout; on timeout or rejection → open popup. Popup-open helper uses a module-level `palettePopupWindowId`: if set and window still exists, call `browser.windows.update(id, { focused: true })`; else `chrome.windows.create({ url: browser.runtime.getURL('command-palette-popup.html'), type: 'popup', width: 560, height: 420, focused: true })`, store id, then post-create call `browser.windows.update(id, { focused: true })` defensively for mac. Register `browser.windows.onRemoved` listener that clears `palettePopupWindowId` when that window closes. Register `browser.permissions.onRemoved` listener that sets `commandPalette.enabled = false` in settings when `history` or `bookmarks` is revoked.
- [x] `entrypoints/options/panes/commandPalette.ts`: new options pane with Enabled toggle, Include History sub-toggle (disabled when Enabled is off), Include Bookmarks sub-toggle (disabled when Enabled is off), and a "Configure shortcut" button. Enabling the pane triggers `browser.permissions.request({ permissions: ['history', 'bookmarks'] })` — if the user denies, the setting reverts and an inline message explains why. Disabling optionally calls `browser.permissions.remove({ permissions: ['history', 'bookmarks'] })` to return to least privilege. The "Configure shortcut" button calls `browser.tabs.create({ url: 'chrome://extensions/shortcuts' })` in its click handler (Chrome disallows navigating to `chrome://` URLs from anchor tags in extension pages). Include a one-line note: "Some sites (Google Docs, code editors) may capture keyboard shortcuts before the extension sees them. Rebind if needed."
- [x] Options nav updated to include the new pane.
- [x] Palette UI keyboard interactions: input autofocuses on mount; ArrowUp/ArrowDown move selection; Enter activates selected result; if no results AND query matches domain regex, Enter opens `https://<query>`; Escape closes palette.
- [x] Palette UI renders ALL user-supplied strings (titles, URLs) via `element.textContent = str`. No `innerHTML` interpolation for attacker-controlled data anywhere in the palette. Static scaffolds (`<div class="...">`) may use `innerHTML`. `utils/html.ts#escapeHtml` is not used in palette rendering.
- [x] Shadow DOM z-index `2147483647` (one higher than the FAB's `2147483646`) so the palette renders above the floating icon when both are enabled.
- [x] Shared CSS for the palette is a single string defined in `utils/commandPalette/styles.ts`, injected by `renderPalette` as a `<style>` element inside `root`. No `:host` selectors (works in both shadow DOM and plain DOM roots). Popup HTML page includes a minimal CSS reset in its own `<style>` block.
- [x] `renderPalette` returns a cleanup function AND is idempotent: calling it while a palette is already rendered in the same root no-ops (content script re-receiving `palette.open` focuses existing input rather than remounting). Snapshot requests in-flight when the palette closes are ignored (guard via `isMounted` flag).
- [x] Background has a module-level `palettePopupWindowId: number | null` and a `browser.windows.onRemoved` listener that clears it. (Code reviewed; manual verification pending: pressing shortcut twice on `chrome://extensions` focuses the existing popup; closing it and pressing again creates a new one.
- [x] Background has a `browser.permissions.onRemoved` listener that toggles `commandPalette.enabled` to `false` when `history` or `bookmarks` is revoked. (Code reviewed; manual verification pending: enable feature, grant perms, revoke via `chrome://extensions`, re-open Options pane → Enabled toggle reflects the revocation.
- [x] `buildSnapshot` is resilient: each of `browser.history.search` and `browser.bookmarks.getTree` is wrapped in a try/catch that returns an empty list on any error. Tabs-only degradation works even if perms are missing. Unit test for this.
- [x] `vitest` suite passes. New tests added for `paletteCanonicalize`, `fuzzyScore`, `buildSnapshot` dedup logic, `filterAndRank` ordering, `activateQueryAsUrl` regex edges, migration 2 → 3.
- [x] `pnpm compile` passes (no TS errors).
- [x] `pnpm lint` passes.
- [x] `pnpm build` succeeds.
- [x] Manual smoke test (documented in plan; human verification pending — cannot be executed from the agent environment): open Chrome with the extension, enable feature in options, grant permissions, press `Cmd+.` on a regular site → palette opens; type partial domain → results appear; Enter on open-tab candidate → switches; Enter on history/bookmark candidate → new tab; Escape closes; press `Cmd+.` on `chrome://extensions` → popup opens instead. User started smoke test via `pnpm dev`; initial report was "Cmd+. does nothing" which was explained by the opt-in default (feature must be enabled in Options first). Awaiting user follow-up on full walkthrough.

## File-level changes

### `utils/types.ts`

- Change: Add `CommandPaletteSettings` interface (`enabled: boolean`, `includeHistory: boolean`, `includeBookmarks: boolean`, `maxResults: number`). Add `commandPalette: CommandPaletteSettings` to `Settings`. Change `schemaVersion` literal from `2` to `3` (not a union — we only support the current version after migration).
- Why: Settings type is the source of truth for persistence shape; bump required to carry new field.
- Risk: low — WXT-chained migrations guarantee stored settings are upgraded to v3 before any consumer reads them.

### `utils/defaults.ts`

- Change: Export `DEFAULT_COMMAND_PALETTE: CommandPaletteSettings` (`{ enabled: false, includeHistory: true, includeBookmarks: true, maxResults: 8 }`). Add `commandPalette: DEFAULT_COMMAND_PALETTE` to `DEFAULT_SETTINGS`. Update `DEFAULT_SETTINGS.schemaVersion` to `3`.
- Why: Every new settings block needs a default.
- Risk: low

### `utils/migrations.ts` (new)

- Change: Create. Export `SETTINGS_MIGRATIONS: Record<number, (prev: Record<string, unknown>) => Record<string, unknown>>`. Move the existing v2 migration body from `storage.ts` verbatim (unchanged). Add v3 migration: `3: (prev) => ({ ...prev, schemaVersion: 3, commandPalette: prev.commandPalette ?? DEFAULT_COMMAND_PALETTE })`. Import `DEFAULT_*` constants from `./defaults`.
- Why: Extracting makes migrations directly unit-testable (can be imported and called) — the current inline `migrations` map inside `storage.defineItem` is not reachable from tests.
- Risk: low — pure refactor, behavior preserved.

### `utils/storage.ts`

- Change: Import `SETTINGS_MIGRATIONS` from `./migrations`. Bump `settingsStore` `version: 2` → `version: 3`. Replace the inline `migrations: { 2: ... }` block with `migrations: SETTINGS_MIGRATIONS`.
- Why: WXT runs migrations in order; we need one for version 3, and we want the map to be importable.
- Risk: low — pattern already established.

### `wxt.config.ts`

- Change: Add `optional_permissions: ['history', 'bookmarks']`. Add `commands: { 'open-command-palette': { suggested_key: { default: 'Ctrl+Period', mac: 'Command+Period' }, description: 'Open Refocus command palette' } }`.
- Why: Optional perms keep install/update dialogs clean. `commands` entry registers the shortcut.
- Risk: low — these are additive.

### `utils/commandPalette/canonicalize.ts` (new)

- Change: Create. Export `paletteCanonicalize(url: string): string`. Behavior: `new URL(url)`; lowercase hostname; clear fragment; iterate `searchParams` and delete any name matching `/^(utm_|mc_|mkt_tok$|_ga$|fbclid$|gclid$|igshid$|yclid$|vero_id$)/i`; preserve path + remaining query params; normalize root path trailing slash (`/` stays `/`; non-root paths are left as-is). Wrap construction in try/catch; return input string on parse failure. **Does NOT strip `ref` or `ref_src`** — those carry meaning on GitHub and similar sites.
- Why: Dedup tab/history/bookmark entries pointing at the same page. Independent of user's dedup `Rule` configuration (the existing `prepare.ts` canonicalization requires a matching rule, which we can't assume for arbitrary URLs).
- Risk: low

### `utils/commandPalette/fuzzy.ts` (new)

- Change: Create. Export `fuzzyScore(query: string, target: string): number | null`. Algorithm: normalize both to lowercase; empty query returns `1.0` (neutral); subsequence match required (all query chars appear in order in target) else `null`; score = base `0.5` + `0.3 * (consecutiveMatchFraction)` + `0.15 * (wordStartMatchesFraction)` + `0.05 * (1 - firstMatchIndex / target.length)`; clamp to [0, 1]. Define `wordStart` as index 0 or position where `target[i-1]` is non-alphanumeric.
- Why: Core of ranking. Hand-rolled keeps bundle small.
- Risk: medium — fuzzy-scoring subtly hard. Mitigation: comprehensive unit tests with named cases.

### `utils/commandPalette/types.ts` (new)

- Change: Create. Export `PaletteCandidateSource = 'tab' | 'bookmark' | 'history'`. Export `PaletteCandidate` (`{ source; url; canonical; title; tabId?; windowId?; lastVisit?: number; score?: number; }`). Export `PaletteSnapshot = { candidates: PaletteCandidate[]; }` (already deduped and ordered for empty-query fallback; content side just filters on query).
- Why: Shared shape between background (producer) and content/popup UI (consumer) must be `JSON.stringify`-safe (no `Map`) since it crosses the message boundary.
- Risk: low

### `utils/commandPalette/search.ts` (new)

- Change: Create. Export `async buildSnapshot(includeHistory: boolean, includeBookmarks: boolean): Promise<PaletteSnapshot>`:
  - `tabs`: `browser.tabs.query({})`; for each tab, read `tabActivityStore.getValue()` once and set `lastVisit = activityMap[tab.id] ?? 0`.
  - `history` (if `includeHistory`): `try { await browser.history.search({ text: '', maxResults: 500, startTime: 0 }) } catch { return [] }`; `lastVisit = item.lastVisitTime ?? 0`.
  - `bookmarks` (if `includeBookmarks`): `try { recursively walk browser.bookmarks.getTree(), flatten leaf nodes with urls } catch { return [] }` (cap at 500); `lastVisit = node.dateAdded ?? 0`.
  - Build candidates, canonicalize each with `paletteCanonicalize`, dedupe with tab > bookmark > history precedence (first-wins via `Map<canonical, PaletteCandidate>`).
  - Empty-query ordering: sort the deduped candidates first by source precedence, then within each source by `lastVisit` desc. Return `{ candidates }`.
- Export `filterAndRank(query: string, snapshot: PaletteSnapshot, maxResults: number): PaletteCandidate[]`:
  - Empty query → return `snapshot.candidates.slice(0, maxResults)`.
  - Non-empty → for each candidate compute `score = fuzzyScore(query, title + ' ' + url)`; drop nulls; final rank key = `score * sourceWeight + recencyBoost`, where `sourceWeight = { tab: 1.0, bookmark: 0.9, history: 0.75 }` and `recencyBoost = 0.1 * max(0, 1 - ageInDays / 30)` using `lastVisit` if > 0. Sort desc; slice to `maxResults`.
- Why: Snapshot-on-open + in-memory filter is the chosen strategy. Kept in utils (not background) so it's unit-testable with mocked `browser.*` APIs and the settings/activity stores.
- Risk: medium — ranking policy is taste; comprehensive tests lock behavior.

### `utils/commandPalette/activate.ts` (new)

- Change: Create. Export `async activateCandidate(c: PaletteCandidate)`. If `c.source === 'tab'` AND `c.tabId != null`: fetch tab via `browser.tabs.get(c.tabId)`; call `focus(tab)`. Else: `browser.tabs.create({ url: c.url, active: true })`. Export `async activateQueryAsUrl(query: string): Promise<boolean>` — if `query` matches `/^[a-z0-9-]+(\.[a-z]{2,})+(\/\S*)?$/i`, open `https://<query>` via `browser.tabs.create`, return true; else return false.
- Why: Isolates activation logic for testing and reuse between content-script palette and popup palette.
- Risk: low — focus() is existing, well-tested.

### `utils/commandPalette/ui.ts` (new)

- Change: Create. Export `renderPalette(root: HTMLElement, services: PaletteServices): () => void` where `PaletteServices = { requestSnapshot: () => Promise<PaletteSnapshot>; activate: (c: PaletteCandidate) => Promise<void>; activateQueryAsUrl: (q: string) => Promise<boolean>; maxResults: number; onClose: () => void }`. Behavior:
  - If `root` already contains a palette element (`root.querySelector('[data-palette-root]')`), refocus the existing input and return a no-op cleanup (idempotent).
  - Inject a `<style>` element with the shared CSS (from `styles.ts`) into `root`; no `:host` selectors.
  - Render a container with `role="dialog"`, `aria-modal="true"`, input autofocused, scrollable `<ul>` for results, empty-state message slot, "Press Enter to open https://<query>" hint when query matches URL regex and no results.
  - `isMounted` flag guards async callbacks: if the palette is unmounted before `requestSnapshot()` resolves, the callback no-ops.
  - On input change: call `filterAndRank` (imported locally — safe because content script doesn't re-query background per keystroke) with the cached snapshot. Update result list via `textContent` for every title/URL.
  - Arrow keys move `selectedIndex`; Enter calls `services.activate(selected)`; if no results and query is a domain, Enter calls `services.activateQueryAsUrl(query)` and closes on `true`; Escape calls `services.onClose`.
  - Returns cleanup that removes the container and the global keydown listener.
- Why: Shared UI between content-script overlay and fallback popup. Pure DOM — takes services as deps for testability.
- Risk: medium — palette UX (focus trap, keyboard nav, accessibility) is fiddly.

### `utils/commandPalette/styles.ts` (new)

- Change: Create. Export `PALETTE_CSS: string` — a single CSS string with selectors scoped via a `[data-palette-root]` attribute on the container. No `:host`, no external imports.
- Why: Works identically in shadow DOM (content script) and plain DOM (popup page).
- Risk: low

### `entrypoints/command-palette.content.ts` (new)

- Change: Create. WXT content script matching `https://*/*` only. At the top of `main(ctx)`, **synchronously** (before any `await`) register `browser.runtime.onMessage.addListener((msg) => { if (msg?.kind === 'palette.open') openPalette(); })`. `openPalette()` (an async function closing over `ctx`):
  - If palette already mounted, re-focus its input and return.
  - `createShadowRootUi(ctx, { name: 'refocus-command-palette', position: 'overlay', zIndex: 2147483647, onMount(container) { /* call renderPalette(container, services) with cleanup tracked in a local variable */ } })`; `ui.mount()`.
  - `services.requestSnapshot` sends `kind: 'palette.snapshot.request'` to background and returns the response.
  - `services.activate` sends `kind: 'palette.activate'` with `{ candidate }`.
  - `services.activateQueryAsUrl` sends `kind: 'palette.activate'` with `{ queryAsUrl: q }` and returns the boolean from background.
  - `services.onClose` calls the cleanup from `renderPalette`, then `ui.remove()`.
- Register `ctx.onInvalidated(() => { /* unmount if mounted */ })`.
- Why: In-page overlay rendering. Lives next to `refocus-fab.content.ts` as a sibling.
- Risk: medium — content script race conditions, focus stealing by host pages. Tests via e2e deferred (Playwright + extensions is fiddly and existing suite is thin); rely on manual smoke test + unit tests on shared utils.

### `entrypoints/command-palette-popup/index.html` (new)

- Change: Create. Minimal HTML scaffold loading `main.ts`. Same styling as content-script palette (shared CSS string inlined or imported).
- Why: Fallback entrypoint for unreachable pages.
- Risk: low

### `entrypoints/command-palette-popup/main.ts` (new)

- Change: Create. Imports `renderPalette` from `utils/commandPalette/ui.ts`, wires `services` where `requestSnapshot` sends `kind: 'palette.snapshot.request'` via `browser.runtime.sendMessage`, `activate` sends `kind: 'palette.activate'` with `{ candidate }`, `activateQueryAsUrl` sends `kind: 'palette.activate'` with `{ queryAsUrl }`. `onClose` calls `window.close()` — valid inside `chrome.windows.create(..., type: 'popup')` pages. Also registers a `beforeunload` no-op for clarity.
- Why: Popup reuses 100% of UI code; only service wiring differs.
- Risk: low

### `entrypoints/background.ts`

- Change:
  - Add module-level `let palettePopupWindowId: number | null = null;` and a helper `openPalettePopup()` that: if `palettePopupWindowId != null`, try `browser.windows.update(palettePopupWindowId, { focused: true })` (catch → fall through to create); else `chrome.windows.create({ url: browser.runtime.getURL('command-palette-popup.html'), type: 'popup', width: 560, height: 420, focused: true })` and store the returned `id`. After create, defensively call `browser.windows.update(id, { focused: true })` (mac focus quirk).
  - Add a helper `isUnreachablePage(url: string): boolean` that returns true for `chrome://`, `chrome-extension://`, `edge://`, `about:`, `file://`, `view-source:`, `https://chrome.google.com/webstore`, `https://chromewebstore.google.com` prefix.
  - Register `browser.commands.onCommand.addListener(async (command) => { ... })` at top level (not inside another listener). Body: if `command !== 'open-command-palette'` return. Read settings; if `!settings.commandPalette.enabled` return. Query active tab in current window. If no active tab or `isUnreachablePage(tab.url)` → `openPalettePopup()`. Else wrap `browser.tabs.sendMessage(tab.id, { kind: 'palette.open' })` in `Promise.race` with a 300ms `setTimeout` → `Promise.reject`; on rejection (timeout or "Could not establish connection") → `openPalettePopup()`.
  - Register `browser.windows.onRemoved.addListener(id => { if (id === palettePopupWindowId) palettePopupWindowId = null; })`.
  - Register `browser.permissions.onRemoved.addListener(async (perms) => { if (perms.permissions?.includes('history') || perms.permissions?.includes('bookmarks')) { await updateSettings(s => { s.commandPalette.enabled = false; }); } })`.
  - Extend the existing `runtime.onMessage` listener (lines 18-37 of current `background.ts`) with two new branches: `kind === 'palette.snapshot.request'` → calls `buildSnapshot(s.commandPalette.includeHistory, s.commandPalette.includeBookmarks)` and responds; `kind === 'palette.activate'` → if `msg.candidate` calls `activateCandidate(msg.candidate)` and responds `{ ok: true }`; if `msg.queryAsUrl` calls `activateQueryAsUrl(msg.queryAsUrl)` and responds `{ ok: true, opened: boolean }`.
- Why: Background is the orchestrator: owns permissions to query tabs/history/bookmarks, routes keyboard shortcut to the right UI, owns the singleton popup window, owns the permissions-revoked watchdog.
- Risk: medium — service worker suspend + command delivery cold-start is the known wart. Accepted.

### `entrypoints/options/panes/commandPalette.ts` (new)

- Change: Create. Follow pattern of `suspend.ts`. Renders Enabled checkbox; Include History / Include Bookmarks sub-toggles (`disabled` attribute when Enabled is off); a "Configure shortcut" button; an info line about editor keyboard-capture sites. On Enabled change to `true`: call `browser.permissions.request({ permissions: ['history', 'bookmarks'] })`; if the promise resolves `false`, revert the checkbox and show an inline error "Permission required — enable history and bookmarks access to use the command palette." On Enabled change to `false`: call `browser.permissions.remove({ permissions: ['history', 'bookmarks'] })` and ignore rejection. The "Configure shortcut" button's click handler calls `browser.tabs.create({ url: 'chrome://extensions/shortcuts' })` (anchor tags can't link to `chrome://`). Re-render the pane whenever settings change so that if `onRemoved` flips `enabled` to false, the UI reflects it.
- Why: Runtime permission grant is the core of the opt-in model.
- Risk: low

### `entrypoints/options/ui.ts` (or wherever nav is registered)

- Change: Add Command Palette entry to the options navigation. Read `ui.ts` first to confirm registration pattern.
- Why: Pane needs a nav entry to be visible.
- Risk: low

### `tests/commandPaletteCanonicalize.test.ts` (new)

- Change: Create. Cases: identical URLs, fragment strip, utm_* strip, gclid strip, mixed-case host, preserved query params, invalid URL fallback.
- Why: Lock canonicalization behavior.
- Risk: low

### `tests/commandPaletteFuzzy.test.ts` (new)

- Change: Create. Cases: empty query returns 1.0, exact match highest, subsequence match present, non-subsequence returns null, word-start wins over mid-word, shorter target wins among equally-good matches, ranking of 3 candidates produces expected order ("gi" → "github.com" > "Great Ideas" > "aging").
- Why: Ranking quality is core UX; tests prevent regressions.
- Risk: low

### `tests/commandPaletteSearch.test.ts` (new)

- Change: Create. Mock `browser.tabs.query`, `browser.history.search`, `browser.bookmarks.getTree`. Test: dedup across sources (tab wins over history for same canonical URL), `includeHistory: false` omits history, `includeBookmarks: false` omits bookmarks, empty query returns snapshot-ordered top-N, query filters correctly, `maxResults` respected.
- Why: The join/dedup/rank is where bugs hide.
- Risk: low

### `tests/commandPaletteActivate.test.ts` (new)

- Change: Create. Mock `browser.tabs.get`, `browser.tabs.create`, `browser.windows.update`. Test: tab candidate → calls focus; non-tab candidate → `browser.tabs.create`. `activateQueryAsUrl` regex: "github.com" → true (opens https://github.com), "github" → false, "localhost:3000" → false (intentional; no TLD), "sub.example.co.uk" → true, "foo bar" → false.
- Why: Lock activation contract.
- Risk: low

### `tests/migrations.test.ts` (new)

- Change: Create. Import `SETTINGS_MIGRATIONS` from `utils/migrations`. Test cases: (a) `migrations[2]({ schemaVersion: 1, dedup: {...} })` output has `schemaVersion: 2`, preserved dedup, and all v2 defaults filled. (b) `migrations[3]({ schemaVersion: 2, dedup: {...}, suspend: {...} })` output has `schemaVersion: 3`, `commandPalette: DEFAULT_COMMAND_PALETTE`, preserved other fields. (c) `migrations[3]({ ..., commandPalette: { enabled: true, includeHistory: false, includeBookmarks: true, maxResults: 5 } })` preserves the existing commandPalette block unchanged.
- Why: Schema migrations are the highest-blast-radius change in this plan; direct unit tests lock behavior.
- Risk: low

### `tests/storage.test.ts`

- Change: No direct changes required; `SETTINGS_MIGRATIONS` now lives in `migrations.ts` and has its own test file. Verify the existing storage tests still pass unchanged.
- Why: Minimize blast radius in the shared storage test file.
- Risk: low

## Test plan

Unit (vitest, all new except `tests/storage.test.ts`):
- `tests/commandPaletteCanonicalize.test.ts` — 6+ cases above, including `?ref=main` preserved and `?utm_source=foo` stripped
- `tests/commandPaletteFuzzy.test.ts` — 6+ cases above
- `tests/commandPaletteSearch.test.ts` — dedup across sources, include toggles respected, maxResults respected, empty-query returns snapshot ordering (tabs by lastVisit), resilience (`history.search` throws → tabs-only result)
- `tests/commandPaletteActivate.test.ts` — tab-vs-URL activation + `activateQueryAsUrl` regex edges
- `tests/migrations.test.ts` — v2 migration, v3 migration fills default, v3 migration preserves existing commandPalette
- `tests/storage.test.ts` — untouched (verify still passes)

No new Playwright e2e in v1 — extension-loading + keyboard-injection in Playwright is brittle and existing e2e coverage is thin. Manual smoke test documented in acceptance criteria covers the integration path. A future task can add e2e once the feature is stable.

Manual smoke test checklist (run as final verification step):
1. `pnpm build`; load `.output/chrome-mv3` as unpacked extension in Chrome.
2. Options → Command Palette: toggle Enabled. Chrome prompts for history/bookmarks permissions; grant.
3. On a normal https page (e.g., https://example.com): press `Cmd+.` (mac) / `Ctrl+.`. Palette appears.
4. Open a few more tabs (github.com, wikipedia.org). Re-open palette; type "gi". GitHub tab appears as top result. Enter → switches to that tab.
5. Close GitHub tab. Re-open palette; type "gi". GitHub appears from history/bookmarks. Enter → opens new tab.
6. Type "nonexistentsiteabc". No results. Palette shows empty state, no domain-fallback hint (it's not a domain shape).
7. Type "example.org". No results. Palette shows "Press Enter to open https://example.org". Enter → new tab to example.org.
8. Press `Cmd+.` on `chrome://extensions`. Popup window opens with the palette. Repeat steps 4-7 in popup. Close with Escape (which calls `window.close`).
9. Press `Cmd+.` twice in quick succession on `chrome://extensions` while a palette popup is already open → the existing popup is re-focused (not a second window).
10. Revoke `history` permission via `chrome://extensions` → Details → Site access/Permissions. Re-open Options → Command Palette: Enabled is now unchecked. Press `Cmd+.` on a regular page → nothing happens (settings is `false`).
11. Options → Command Palette: toggle Enabled off. Press `Cmd+.` — nothing happens.

## Out of scope

- Playwright e2e for the full shortcut flow. Defer to a follow-up; manual smoke test covers v1.
- Command actions beyond tab/URL navigation (e.g., "close this tab", "mute tab", custom commands). v2 surface area.
- Configurable search engine fallback for non-domain queries. v2.
- Recent-queries history / last-used-result persistence. v2.
- Cross-window tab labeling ("(other window)" badge). v2.
- Per-host configurability (e.g., "disable palette on docs.google.com").
- Firefox explicit testing. Codebase already supports Firefox builds; the design uses only cross-browser APIs. Chrome Web Store is the target; Firefox is a happy-path.
- Merging with the FAB content script into a unified overlay script. Separate is simpler for v1.

## Open questions

- Existing debt: `comment_check` in directories this plan touches surfaces nothing older than 30 days (repo is ~1 month old). No inherited tech debt to flag.
- Shortcut `Ctrl+.` / `Cmd+.` is known to conflict with some editor sites (VS Code Web, etc.). Users can rebind via `chrome://extensions/shortcuts`. Surface this in the Options pane with a "Configure shortcut" link. Documented; no blocking action.
