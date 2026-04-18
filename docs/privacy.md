# Refocus — Privacy Policy

_Last updated: 2026-04-18_

Refocus is a browser extension that (1) reuses existing tabs instead of opening duplicates and (2) notifies you of GitHub Pull Request state changes. This policy describes what Refocus does with data.

## TL;DR

- **No telemetry. No analytics. No third-party services.**
- Refocus runs entirely in your browser.
- Your GitHub token never leaves your device except to talk to the GitHub API endpoint you configure.
- Tab URLs are read only to compare them against the currently-opening tab for dedup purposes. They are never transmitted anywhere.

## What data Refocus handles

### Tab URLs

To find an existing tab matching a newly-opened URL, Refocus reads the URLs of your open tabs via the `tabs` permission. The comparison happens locally in the extension's service worker. URLs are not logged, stored persistently, or sent over the network.

### GitHub authentication token

If you enable Watch, Refocus requires a GitHub OAuth token or personal access token. This token is stored in the browser's extension `storage.local` on your device. It is used only to make authenticated requests to the API base URL you configure (default: `https://api.github.com`; or a GitHub Enterprise instance if you set one). Signing out removes the token.

### GitHub PR metadata

While Watch is enabled, Refocus periodically queries the GitHub API for metadata about the PRs you care about (title, author, checks status, reviews, comments). A compact per-PR snapshot is stored in `storage.local` to detect state changes between polls. Stored snapshots are evicted automatically after 30 days of inactivity.

### Settings

User preferences (dedup rules, watched repos, notification toggles, etc.) sync across your browser profile via `storage.sync`. Settings are stored by the browser vendor (Google/Chrome, Mozilla/Firefox) subject to their own policies. Refocus does not operate its own server or upload settings anywhere.

## What Refocus does NOT do

- No telemetry, analytics, or crash reporting.
- No tracking of which URLs you visit, how often, or when.
- No third-party SDKs or advertising.
- No sending of any data to servers operated by Refocus or its authors. Refocus does not operate a server.

## Permissions

| Permission | Why Refocus needs it |
|---|---|
| `tabs` | Read tab URLs for dedup; focus / close tabs |
| `storage` | Store settings, auth token, PR snapshots |
| `alarms` | Schedule Watch polling |
| `notifications` | Show PR state-change notifications |
| `identity` | Open the GitHub OAuth flow |
| `webNavigation` | (Optional) address-bar dedup |
| `host_permissions: api.github.com` | Make GitHub API requests |
| `optional_host_permissions` | User-granted, for GitHub Enterprise hosts |

## Contact

Issues and questions: https://github.com/iceglober/refocus-extension/issues
