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
 * Minutes of real WORK logged against one item.
 *
 * WORK only, and only closed rows: a BREAK is not time spent on the item, and
 * an in-flight session has no `duration` yet — counting it as 0 is the same
 * answer as skipping it, but skipping says so. Fractional minutes are kept
 * (the caller formats), for the same reason the ring keeps them: rounding here
 * would make a list of items add up to less than the total logged.
 */
export function totalWorkMinutesForItem(
  sessions: readonly TimerSession[],
  itemId: string,
): number {
  let minutes = 0;
  for (const s of sessions) {
    if (s.sessionType !== "WORK") continue;
    if (s.duration == null || s.duration <= 0) continue;
    if (sessionTargetId(s) !== itemId) continue;
    minutes += s.duration / 60;
  }
  return minutes;
}
