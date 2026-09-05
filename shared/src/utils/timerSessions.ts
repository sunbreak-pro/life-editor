import type { TimerSession } from "../types/timer";

/*
 * Reading a timer_sessions log (#1375).
 *
 * A session names at most one item — a Todo in `task_id` or an Event in
 * `event_id` (0029) — and every caller that asks "what was this time spent on"
 * has to unfold that pair the same way. Before this module the answer was
 * inlined in `aggregateWorkTimeByTag` alone, which was fine while Todo was the
 * only possible answer; the Event editor now asks the same question from a
 * different screen, and two hand-rolled copies of "todoId ?? eventId" would
 * drift the moment a third target appears.
 *
 * Pure and dependency-free so both the shared tree and the hosts can use it.
 */

/**
 * The id a session is attributed to, whichever column holds it.
 *
 * Truthiness rather than `!= null` on purpose: an empty-string id is not an
 * attribution, and the aggregation reads "no id" as genuinely target-less work
 * rather than as work on a trashed item (#428) — the two answers are handled
 * differently, so the distinction has to survive this call.
 */
export function sessionTargetId(session: TimerSession): string | null {
  return session.todoId || session.eventId || null;
}

/**
 * How short a never-completed session has to be before it reads as a scrap
 * rather than as work (#1475).
 *
 * Starting the timer and stopping it again seconds later is not a mistake the
 * UI can prevent — pause closes the in-flight row with the seconds elapsed, and
 * a reset afterwards has nothing left to withdraw. Those rows then showed up as
 * a Todo in "work time by todo" and as sessions in the weekly comparison, which
 * is what #1475 reported: two 12-second rows left by two aborted starts.
 *
 * A minute is the resolution the charts themselves work in, so nothing that
 * survives this cut was ever going to move a bar by a visible amount.
 */
export const ABANDONED_SESSION_SECONDS = 60;

/**
 * True when a row records time worth counting.
 *
 * Three kinds of row are dropped: one still in flight (no `duration` yet), one
 * closed at zero, and an abandoned scrap (never completed AND shorter than
 * `ABANDONED_SESSION_SECONDS`).
 *
 * A long unfinished session is NOT a scrap and stays counted — pausing after 20
 * real minutes and never coming back is the ordinary way an interrupted phase
 * ends, and that time was worked. `completed` alone therefore cannot be the
 * test; it only says whether the phase ran to its target, which is what the
 * pomodoro-rate card asks separately.
 *
 * A type predicate so callers keep the `duration` narrowing they had when this
 * test was written inline.
 */
export function isCountedSession(
  session: TimerSession,
): session is TimerSession & { duration: number } {
  const { duration } = session;
  if (duration == null || duration <= 0) return false;
  if (!session.completed && duration < ABANDONED_SESSION_SECONDS) return false;
  return true;
}

/**
 * Minutes of real WORK logged against one item.
 *
 * WORK only, and only rows that count (`isCountedSession`): a BREAK is not time
 * spent on the item, an in-flight session has no `duration` yet, and an aborted
 * start is not work. Fractional minutes are kept (the caller formats), for the
 * same reason the ring keeps them: rounding here would make a list of items add
 * up to less than the total logged.
 */
export function totalWorkMinutesForItem(
  sessions: readonly TimerSession[],
  itemId: string,
): number {
  let minutes = 0;
  for (const s of sessions) {
    if (s.sessionType !== "WORK") continue;
    if (!isCountedSession(s)) continue;
    if (sessionTargetId(s) !== itemId) continue;
    minutes += s.duration / 60;
  }
  return minutes;
}
