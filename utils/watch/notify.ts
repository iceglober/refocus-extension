import { settingsStore } from '../storage';
import type { PrEvent } from '../types';

const PER_PR_WINDOW_MS = 5000;
const perPrLastFire = new Map<string, number>();

async function park(notifId: string, url: string): Promise<void> {
  await browser.storage.session.set({ [`notif:${notifId}`]: url });
}
async function reclaim(notifId: string): Promise<string | null> {
  const key = `notif:${notifId}`;
  const res = await browser.storage.session.get(key);
  const url = res[key] as string | undefined;
  if (!url) return null;
  await browser.storage.session.remove(key);
  return url;
}

export async function dispatch(event: PrEvent): Promise<void> {
  const settings = await settingsStore.getValue();
  if (!settings.watch.enabled) return;
  if (!settings.watch.notifyOn[event.kind]) return;
  if (settings.watch.repoMutes.includes(event.pr.repo)) return;

  const now = Date.now();
  const last = perPrLastFire.get(event.pr.id) ?? 0;
  if (now - last < PER_PR_WINDOW_MS) return;
  perPrLastFire.set(event.pr.id, now);

  const prTag = `${event.pr.repo}#${event.pr.number}`;
  const title = `${formatTitle(event)} · ${prTag}`;
  const message =
    event.kind === 'checks.failed'
      ? `${truncate(event.pr.title)}\n${event.failing.slice(0, 3).join(', ')}`
      : truncate(event.pr.title);

  const notifId = `refocus:${event.pr.id}:${event.kind}:${now}`;
  await browser.notifications.create(notifId, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title,
    message,
    contextMessage: event.pr.repo,
  });
  await park(notifId, event.pr.url);
}

const REVIEW_META: Record<string, { emoji: string; verb: string }> = {
  APPROVED: { emoji: '✅', verb: 'approved' },
  CHANGES_REQUESTED: { emoji: '❌', verb: 'requested changes' },
};

function formatTitle(event: PrEvent): string {
  switch (event.kind) {
    case 'checks.passed':    return '✅ Checks passed';
    case 'checks.failed':    return '❌ Checks failed';
    case 'checks.pending':   return '⏳ Checks running';
    case 'merged':           return '🎉 Merged';
    case 'closed':           return '🚫 Closed';
    case 'conflict.added':   return '⚠️ Conflicts';
    case 'conflict.cleared': return '✅ Conflicts resolved';
    case 'mention':          return `💬 ${event.author} mentioned you`;
    case 'review.submitted': {
      const m = REVIEW_META[event.state] ?? { emoji: '💬', verb: 'commented' };
      return `${m.emoji} ${event.reviewer} ${m.verb}`;
    }
  }
}

function truncate(s: string, max = 80): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function registerNotificationHandlers(): void {
  const open = async (notifId: string) => {
    const url = await reclaim(notifId);
    if (!url) return;
    await browser.tabs.create({ url });
    browser.notifications.clear(notifId);
  };

  browser.notifications.onClicked.addListener(open);
  browser.notifications.onButtonClicked.addListener(
    async (notifId, buttonIdx) => {
      if (buttonIdx === 0) await open(notifId);
      else browser.notifications.clear(notifId);
    },
  );
  browser.notifications.onClosed.addListener((notifId) => {
    browser.storage.session.remove(`notif:${notifId}`).catch(() => {});
  });
}
