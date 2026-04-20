export type PaletteCandidateSource = 'tab' | 'bookmark' | 'history';

export interface PaletteCandidate {
  source: PaletteCandidateSource;
  url: string;
  canonical: string;
  title: string;
  tabId?: number;
  windowId?: number;
  /** ms epoch of most-recent-activity signal available (tab activity, bookmark dateAdded, history lastVisitTime) */
  lastVisit?: number;
  /** populated by filterAndRank; not present in raw snapshot */
  score?: number;
}

export interface PaletteSnapshot {
  candidates: PaletteCandidate[];
}
