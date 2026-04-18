const PR_RE = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/.*)?$/;

export function githubPr(url: URL): URL | null {
  if (url.host !== 'github.com') return null;
  const m = PR_RE.exec(url.pathname);
  if (!m) return null;
  const [, owner, repo, num] = m;
  return new URL(`https://github.com/${owner}/${repo}/pull/${num}`);
}
