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
    return true;
  }
}

export function safeParse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}
