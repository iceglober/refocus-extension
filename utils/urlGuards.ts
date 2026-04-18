const INTERNAL_SCHEMES = [
  'chrome:',
  'chrome-extension:',
  'edge:',
  'about:',
  'brave:',
  'opera:',
  'vivaldi:',
  'arc:',
  'data:',
  'blob:',
  'javascript:',
  'view-source:',
];

export function isInternalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return INTERNAL_SCHEMES.some((s) => u.protocol === s);
  } catch {
    return true; // unparseable → treat as internal (don't touch)
  }
}

export function isNewTabPage(url: string): boolean {
  return (
    url === 'chrome://newtab/' ||
    url === 'edge://newtab/' ||
    url === 'about:newtab' ||
    url === 'about:blank'
  );
}

export function safeParse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}
