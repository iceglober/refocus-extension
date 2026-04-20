/**
 * CSS for the palette. Scoped entirely via the `[data-palette-root]` attribute
 * — no `:host` selectors — so it works identically in a shadow DOM (content
 * script) and a plain DOM (popup page).
 */
export const PALETTE_CSS = `
[data-palette-root] {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  font-size: 14px;
  color: #1a1a1a;
  z-index: 2147483647;
}
[data-palette-root][data-embedded="true"] {
  background: transparent;
  padding: 0;
  inset: 0;
}
[data-palette-root] [data-palette-card] {
  width: min(560px, 92vw);
  max-height: 70vh;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
[data-palette-root][data-embedded="true"] [data-palette-card] {
  width: 100%;
  max-height: 100vh;
  border-radius: 0;
  box-shadow: none;
}
[data-palette-root] [data-palette-input] {
  width: 100%;
  padding: 14px 18px;
  font-size: 16px;
  border: 0;
  border-bottom: 1px solid #eee;
  outline: none;
  box-sizing: border-box;
  background: #fff;
  color: #1a1a1a;
}
[data-palette-root] [data-palette-list] {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  flex: 1;
}
[data-palette-root] [data-palette-list] li {
  padding: 8px 18px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
[data-palette-root] [data-palette-list] li[aria-selected="true"] {
  background: #2f6cff;
  color: #fff;
}
[data-palette-root] [data-palette-list] li[aria-selected="true"] .url {
  color: rgba(255, 255, 255, 0.85);
}
[data-palette-root] .title {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
[data-palette-root] .url {
  font-size: 12px;
  color: #6a6a6a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
[data-palette-root] .source {
  display: inline-block;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-right: 6px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #eef2ff;
  color: #2f6cff;
  vertical-align: middle;
}
[data-palette-root] [aria-selected="true"] .source {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}
[data-palette-root] [data-palette-empty] {
  padding: 18px;
  color: #6a6a6a;
  text-align: center;
}
[data-palette-root] [data-palette-hint] {
  padding: 10px 18px;
  font-size: 12px;
  color: #6a6a6a;
  border-top: 1px solid #eee;
  background: #fafafa;
}
`;
