/*
 * A note left in the browser about the timer_sessions row this tab has open
 * (#1857).
 *
 * The Provider closes its row on pause, reset and completion, but a reload or
 * a closed tab gives it no turn: the row keeps a null `ended_at` and nothing
 * ever comes back for it. The next startup can find such rows, but the DB
 * alone cannot say how long one ran, only when it started. This marker is the
 * missing half: the row id plus the last moment the tab was seen alive,
 * refreshed by the same 1 s pulse that drives the display.
 *
 * It is NOT a persisted running state. Nothing here resumes a timer; it only
 * lets the next startup close the row with the time that was really worked.
 *
 * localStorage is shared by every tab of the origin, so the marker says which
 * tab wrote it. The tab id lives in sessionStorage, which a reload keeps and a
 * second tab does not share: a marker carrying this tab's own id is certainly
 * dead (this tab has only just mounted), while a fresh marker from another id
 * is a timer running next door and must be left alone.
 *
 * Every access is wrapped: storage can throw (private window, blocked site
 * data), and the timer has to run without it.
 */

const MARKER_KEY = "life-editor:timer-open-session";
const TAB_ID_KEY = "life-editor:timer-tab-id";

/**
 * How recent a foreign marker has to be to read as a live tab. Well above the
 * 1 s pulse because a hidden tab's timers are throttled, down to one wake-up a
 * minute once the browser decides the tab is idle.
 */
export const OPEN_SESSION_MARKER_LIVE_MS = 90_000;

export interface OpenSessionMarker {
  sessionId: number;
  tabId: string;
  /** Epoch ms of the last pulse the owning tab lived through. */
  lastSeenAt: number;
}

let memoryTabId: string | null = null;

/** This tab's id: stable across a reload, distinct per tab. */
export function timerTabId(): string {
  try {
    const existing = window.sessionStorage.getItem(TAB_ID_KEY);
    if (existing) return existing;
    const created = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(TAB_ID_KEY, created);
    return created;
  } catch {
    memoryTabId ??= `mem-${Date.now().toString(36)}`;
    return memoryTabId;
  }
}

export function readOpenSessionMarker(): OpenSessionMarker | null {
  try {
    const raw = window.localStorage.getItem(MARKER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { sessionId, tabId, lastSeenAt } = parsed as Record<string, unknown>;
    if (
      typeof sessionId !== "number" ||
      typeof tabId !== "string" ||
      typeof lastSeenAt !== "number"
    ) {
      return null;
    }
    return { sessionId, tabId, lastSeenAt };
  } catch {
    return null;
  }
}

export function writeOpenSessionMarker(sessionId: number, now: number): void {
  try {
    const marker: OpenSessionMarker = {
      sessionId,
      tabId: timerTabId(),
      lastSeenAt: now,
    };
    window.localStorage.setItem(MARKER_KEY, JSON.stringify(marker));
  } catch {
    // Without storage the row is still recovered at the next startup, as a
    // discarded one: see `planOrphanRecovery`.
  }
}

/**
 * Drop the marker, but only the one for `sessionId`: a second tab may have
 * written its own since, and that one is not ours to remove.
 */
export function clearOpenSessionMarker(sessionId: number): void {
  try {
    if (readOpenSessionMarker()?.sessionId !== sessionId) return;
    window.localStorage.removeItem(MARKER_KEY);
  } catch {
    // Same as above.
  }
}

/**
 * How old an open row nobody vouches for has to be before it is closed. The
 * longest phase the settings allow is 240 minutes, so a row older than that
 * cannot be a segment still running on some other device.
 */
export const ORPHAN_SESSION_STALE_MS = 240 * 60 * 1000;

export interface OrphanRecovery<S> {
  session: S;
  /** Seconds to close the row with; 0 discards it (`isCountedSession`). */
  durationSeconds: number;
}

/**
 * Decide what the startup sweep closes, and with how many seconds (#1857).
 *
 *  - The row the marker names is closed with the time up to the last pulse,
 *    unless another tab is visibly still running it.
 *  - Any other open row is only touched once it is too old to be live, and is
 *    closed at zero: nothing recorded how long it ran, and a guess would put
 *    invented minutes into Analytics. Rows left by builds before the marker
 *    existed end up here.
 *  - A young row nobody vouches for is left alone. It may be a timer running
 *    on another device right now.
 *
 * Pure, so the three cases are pinned without a Provider around them.
 */
export function planOrphanRecovery<S extends { id: number; startedAt: Date }>(
  openSessions: readonly S[],
  marker: OpenSessionMarker | null,
  ownTabId: string,
  now: number,
): OrphanRecovery<S>[] {
  const plan: OrphanRecovery<S>[] = [];
  for (const session of openSessions) {
    const startedAt = session.startedAt.getTime();
    if (marker && marker.sessionId === session.id) {
      const liveElsewhere =
        marker.tabId !== ownTabId &&
        now - marker.lastSeenAt <= OPEN_SESSION_MARKER_LIVE_MS;
      if (liveElsewhere) continue;
      plan.push({
        session,
        durationSeconds: Math.max(
          0,
          Math.floor((marker.lastSeenAt - startedAt) / 1000),
        ),
      });
      continue;
    }
    if (now - startedAt > ORPHAN_SESSION_STALE_MS) {
      plan.push({ session, durationSeconds: 0 });
    }
  }
  return plan;
}
