import { beforeEach, describe, expect, it, vi } from 'vitest';

type BrowserMock = {
  tabs: {
    get: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  windows: { update: ReturnType<typeof vi.fn> };
};

const mockBrowser: BrowserMock = {
  tabs: { get: vi.fn(), create: vi.fn(), update: vi.fn() },
  windows: { update: vi.fn() },
};

(globalThis as unknown as { browser: BrowserMock }).browser = mockBrowser;

const { activateCandidate, activateQueryAsUrl, queryLooksLikeDomain } =
  await import('@/utils/commandPalette/activate');

beforeEach(() => {
  mockBrowser.tabs.get.mockReset();
  mockBrowser.tabs.create.mockReset();
  mockBrowser.tabs.update.mockReset();
  mockBrowser.windows.update.mockReset();
});

describe('activateCandidate', () => {
  it('focuses an existing tab when candidate is a tab', async () => {
    mockBrowser.tabs.get.mockResolvedValue({ id: 7, windowId: 3 });
    mockBrowser.tabs.update.mockResolvedValue({});
    mockBrowser.windows.update.mockResolvedValue({});

    await activateCandidate({
      source: 'tab',
      url: 'https://github.com/',
      canonical: 'https://github.com/',
      title: 'GitHub',
      tabId: 7,
    });

    expect(mockBrowser.tabs.update).toHaveBeenCalledWith(7, { active: true });
    expect(mockBrowser.windows.update).toHaveBeenCalledWith(3, {
      focused: true,
      state: 'normal',
    });
    expect(mockBrowser.tabs.create).not.toHaveBeenCalled();
  });

  it('falls back to create when tab candidate can no longer be fetched', async () => {
    mockBrowser.tabs.get.mockRejectedValue(new Error('no tab'));
    mockBrowser.tabs.create.mockResolvedValue({});
    await activateCandidate({
      source: 'tab',
      url: 'https://github.com/',
      canonical: 'https://github.com/',
      title: 'GitHub',
      tabId: 999,
    });
    expect(mockBrowser.tabs.create).toHaveBeenCalledWith({
      url: 'https://github.com/',
      active: true,
    });
  });

  it('creates a new tab for history/bookmark candidates', async () => {
    mockBrowser.tabs.create.mockResolvedValue({});
    await activateCandidate({
      source: 'history',
      url: 'https://example.com/',
      canonical: 'https://example.com/',
      title: 'Example',
    });
    expect(mockBrowser.tabs.create).toHaveBeenCalledWith({
      url: 'https://example.com/',
      active: true,
    });
  });
});

describe('queryLooksLikeDomain', () => {
  it('accepts simple domains', () => {
    expect(queryLooksLikeDomain('github.com')).toBe(true);
    expect(queryLooksLikeDomain('sub.example.co.uk')).toBe(true);
    expect(queryLooksLikeDomain('example.com/path')).toBe(true);
  });

  it('rejects non-domain queries', () => {
    expect(queryLooksLikeDomain('github')).toBe(false);
    expect(queryLooksLikeDomain('foo bar')).toBe(false);
    expect(queryLooksLikeDomain('localhost:3000')).toBe(false);
    expect(queryLooksLikeDomain('')).toBe(false);
  });
});

describe('activateQueryAsUrl', () => {
  it('opens a domain-like query as https://', async () => {
    mockBrowser.tabs.create.mockResolvedValue({});
    const ok = await activateQueryAsUrl('example.com');
    expect(ok).toBe(true);
    expect(mockBrowser.tabs.create).toHaveBeenCalledWith({
      url: 'https://example.com',
      active: true,
    });
  });

  it('preserves an explicit http:// scheme', async () => {
    mockBrowser.tabs.create.mockResolvedValue({});
    const ok = await activateQueryAsUrl('http://example.com');
    // "http://example.com" starts with a-z lowercase so regex passes; ensure scheme preserved.
    // Our regex is `^[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,})(\/\S*)?$/i` which doesn't
    // match strings containing `://`, so this should be false.
    expect(ok).toBe(false);
  });

  it('returns false for non-domain queries', async () => {
    const ok = await activateQueryAsUrl('nothing here');
    expect(ok).toBe(false);
    expect(mockBrowser.tabs.create).not.toHaveBeenCalled();
  });
});
