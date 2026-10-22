/*
 * When to re-read everything after a gap (#2329 — plan
 * 2026-10-21-offline-cache.md P0).
 *
 * Realtime only tells this tab about changes it was connected for. While the
 * socket is down — the laptop slept, the phone left coverage, the tab sat in
 * the background long enough for the browser to drop it — another device's
 * writes produce no message here, and nothing re-read them: the screen kept
 * the lists from before the gap until some unrelated change happened to bump
 * the same domain.
 *
 * Three signals mean "a gap may have just ended", and each one resumes:
 *   - the channel reports SUBSCRIBED again after it had dropped
 *     (CHANNEL_ERROR / TIMED_OUT / CLOSED). The FIRST SUBSCRIBED is the
 *     initial join and the domains are loading anyway, so it does not count;
 *   - the browser's `online` event;
 *   - the page becoming visible after at least `HIDDEN_RESUME_MS` hidden.
 *     The iOS shell has no app-resume plugin, and WKWebView fires
 *     `visibilitychange` when the app comes back, so this covers it.
 *
 * They often arrive together (coming back online re-joins the channel), so
 * SyncProvider sends every resume through its 300 ms bump queue, which folds
 * them into one re-read.
 *
 * No React and no timers of its own, so a test can drive it with a fake clock.
 */

/** A page hidden for less than this has missed nothing worth a re-read. */
export const HIDDEN_RESUME_MS = 30_000;

/** The channel states realtime-js passes to the `subscribe` callback. */
export type ChannelStatus =
  "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";

export interface SyncResume {
  /** Pass the `subscribe` callback's status straight through. */
  channelStatus(status: ChannelStatus | string): void;
  /** The window's `online` event. */
  online(): void;
  /** The document's `visibilitychange` event, with `document.hidden`. */
  visibilityChange(hidden: boolean): void;
}

export function createSyncResume(
  resume: () => void,
  now: () => number = Date.now,
): SyncResume {
  let joined = false;
  let dropped = false;
  let hiddenAt: number | null = null;

  return {
    channelStatus(status) {
      if (status === "SUBSCRIBED") {
        if (joined && dropped) resume();
        joined = true;
        dropped = false;
        return;
      }
      if (joined) dropped = true;
    },
    online() {
      resume();
    },
    visibilityChange(hidden) {
      if (hidden) {
        hiddenAt = now();
        return;
      }
      if (hiddenAt === null) return;
      const away = now() - hiddenAt;
      hiddenAt = null;
      if (away >= HIDDEN_RESUME_MS) resume();
    },
  };
}
