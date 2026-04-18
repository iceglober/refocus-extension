const ISSUE_RE = /^\/([^/]+)\/([^/]+)\/issues\/(\d+)(?:\/.*)?$/;

export function githubIssue(url: URL): URL | null {
  if (url.host !== 'github.com') return null;
  const m = ISSUE_RE.exec(url.pathname);
  if (!m) return null;
  const [, owner, repo, num] = m;
  return new URL(`https://github.com/${owner}/${repo}/issues/${num}`);
}
