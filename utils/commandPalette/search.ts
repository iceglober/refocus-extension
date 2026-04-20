import { tabActivityStore } from '../storage';
import { paletteCanonicalize } from './canonicalize';
import { fuzzyScore } from './fuzzy';
import type {
  PaletteCandidate,
  PaletteCandidateSource,
  PaletteSnapshot,
} from './types';

const SOURCE_WEIGHT: Record<PaletteCandidateSource, number> = {
  tab: 1,
  bookmark: 0.9,
  history: 0.75,
};

const SOURCE_PRECEDENCE: Record<PaletteCandidateSource, number> = {
  tab: 0,
  bookmark: 1,
  history: 2,
};

const MAX_HISTORY = 500;
const MAX_BOOKMARKS = 500;

async function collectTabs(): Promise<PaletteCandidate[]> {
  let tabs;
  try {
    tabs = await browser.tabs.query({});
  } catch {
    return [];
  }
  let activity: Record<number, number> = {};
  try {
    activity = await tabActivityStore.getValue();
  } catch {
    activity = {};
  }
  const out: PaletteCandidate[] = [];
  for (const t of tabs) {
    if (!t.url || t.id == null) continue;
    const candidate: PaletteCandidate = {
      source: 'tab',
      url: t.url,
      canonical: paletteCanonicalize(t.url),
      title: t.title ?? t.url,
      tabId: t.id,
      lastVisit: activity[t.id] ?? 0,
    };
    if (t.windowId != null) candidate.windowId = t.windowId;
    out.push(candidate);
  }
  return out;
}

async function collectHistory(): Promise<PaletteCandidate[]> {
  try {
    const items = await browser.history.search({
      text: '',
      maxResults: MAX_HISTORY,
      startTime: 0,
    });
    const out: PaletteCandidate[] = [];
    for (const h of items) {
      if (!h.url) continue;
      out.push({
        source: 'history',
        url: h.url,
        canonical: paletteCanonicalize(h.url),
        title: h.title || h.url,
        lastVisit: h.lastVisitTime ?? 0,
      });
    }
    return out;
  } catch {
    return [];
  }
}

interface BookmarkNodeLike {
  url?: string;
  title?: string;
  dateAdded?: number;
  children?: BookmarkNodeLike[];
}

function flattenBookmarks(
  nodes: readonly BookmarkNodeLike[],
  out: PaletteCandidate[],
  limit: { n: number },
): void {
  for (const n of nodes) {
    if (limit.n >= MAX_BOOKMARKS) return;
    if (n.url) {
      out.push({
        source: 'bookmark',
        url: n.url,
        canonical: paletteCanonicalize(n.url),
        title: n.title || n.url,
        lastVisit: n.dateAdded ?? 0,
      });
      limit.n++;
    }
    if (n.children) flattenBookmarks(n.children, out, limit);
  }
}

async function collectBookmarks(): Promise<PaletteCandidate[]> {
  try {
    const tree = await browser.bookmarks.getTree();
    const out: PaletteCandidate[] = [];
    flattenBookmarks(tree, out, { n: 0 });
    return out;
  } catch {
    return [];
  }
}

export async function buildSnapshot(
  includeHistory: boolean,
  includeBookmarks: boolean,
): Promise<PaletteSnapshot> {
  const [tabs, bookmarks, history] = await Promise.all([
    collectTabs(),
    includeBookmarks ? collectBookmarks() : Promise.resolve([]),
    includeHistory ? collectHistory() : Promise.resolve([]),
  ]);

  // Dedup by canonical URL with tab > bookmark > history precedence.
  const byCanonical = new Map<string, PaletteCandidate>();
  for (const c of [...tabs, ...bookmarks, ...history]) {
    const existing = byCanonical.get(c.canonical);
    if (!existing) {
      byCanonical.set(c.canonical, c);
      continue;
    }
    if (SOURCE_PRECEDENCE[c.source] < SOURCE_PRECEDENCE[existing.source]) {
      byCanonical.set(c.canonical, c);
    }
  }

  // Empty-query ordering: by source precedence, then by lastVisit desc.
  const candidates = [...byCanonical.values()].sort((a, b) => {
    const pa = SOURCE_PRECEDENCE[a.source];
    const pb = SOURCE_PRECEDENCE[b.source];
    if (pa !== pb) return pa - pb;
    return (b.lastVisit ?? 0) - (a.lastVisit ?? 0);
  });

  return { candidates };
}

function recencyBoost(lastVisit: number | undefined): number {
  if (!lastVisit) return 0;
  const ageMs = Date.now() - lastVisit;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return 0.1 * Math.max(0, 1 - ageDays / 30);
}

export function filterAndRank(
  query: string,
  snapshot: PaletteSnapshot,
  maxResults: number,
): PaletteCandidate[] {
  const all = Array.isArray(snapshot?.candidates) ? snapshot.candidates : [];
  if (!query.trim()) {
    return all.slice(0, maxResults);
  }
  const scored: PaletteCandidate[] = [];
  for (const c of all) {
    const target = `${c.title} ${c.url}`;
    const s = fuzzyScore(query, target);
    if (s == null) continue;
    const rank = s * SOURCE_WEIGHT[c.source] + recencyBoost(c.lastVisit);
    scored.push({ ...c, score: rank });
  }
  scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return scored.slice(0, maxResults);
}
