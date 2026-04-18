# Refocus — Chrome Web Store listing

## Short description (132 chars)

Reuse existing tabs instead of opening duplicates, and get OS notifications for GitHub PR status changes.

## Full description

Refocus is two focused tools in one extension.

### Dedup

Click a GitHub PR link from Slack and the PR is already open on the Files tab? Refocus brings the existing tab forward instead of spawning a duplicate. A pipeline-based URL normalization engine knows that `/pull/123`, `/pull/123/files`, and `/pull/123/commits` are the same PR. Ships with built-in normalizers for GitHub PRs, GitHub Issues, Google Docs/Sheets/Slides, and YouTube videos. Author custom rules with regex or built-ins.

### Watch

GitHub desktop/mobile notifications are limited: GitHub Desktop only notifies on check failure and only for the selected repo; GitHub Mobile is phone-only; email is slow. Refocus polls the GitHub API for PRs you author, are assigned to, or are review-requested on — plus explicit PRs/repos you add — and fires OS notifications on:

- Checks failed / passed
- Review submitted (approved, changes requested, commented)
- PR merged / closed
- Conflicts appeared / resolved
- @-mentions in comments

Click a notification and the PR opens in your browser — routed through Dedup, so if you already have a tab for it, that's the one that focuses.

### Privacy

No telemetry. No third-party services. Your GitHub token stays in local extension storage and is only used against the GitHub API endpoint you configure (defaults to api.github.com, or your GitHub Enterprise instance). Tab URLs are read only to perform dedup and are never transmitted.

### Screenshots

1. Dedup action: before (two PR tabs) / after (one PR tab, `/files` preserved).
2. Notification toast: "✅ Checks passed · org/repo#142".
3. Options page: Dedup rules editor.
4. Options page: Watch Targets and Notifications.
