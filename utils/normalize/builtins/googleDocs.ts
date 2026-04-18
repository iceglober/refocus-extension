const DOCS_RE = /^\/document\/d\/([^/]+)(?:\/.*)?$/;
const SHEETS_RE = /^\/spreadsheets\/d\/([^/]+)(?:\/.*)?$/;
const SLIDES_RE = /^\/presentation\/d\/([^/]+)(?:\/.*)?$/;

export function googleDocs(url: URL): URL | null {
  if (url.host !== 'docs.google.com') return null;
  const docs = DOCS_RE.exec(url.pathname);
  if (docs)
    return new URL(`https://docs.google.com/document/d/${docs[1]}/edit`);
  const sheets = SHEETS_RE.exec(url.pathname);
  if (sheets)
    return new URL(`https://docs.google.com/spreadsheets/d/${sheets[1]}/edit`);
  const slides = SLIDES_RE.exec(url.pathname);
  if (slides)
    return new URL(`https://docs.google.com/presentation/d/${slides[1]}/edit`);
  return null;
}
