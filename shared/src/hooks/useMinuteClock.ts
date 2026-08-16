import { useEffect, useMemo, useState } from "react";

/*
 * The one clock a calendar screen needs, ticked once a minute (#889).
 *
 * Schedule wants "now" in two shapes: a Date, because deriveScheduleStatus
 * (#222) has to compare across days, and minutes-from-midnight, because the
 * now-line and the agenda divider are positions inside one day. Those were
 * two `useState`s ticked side by side in one interval:
 *
 *   setNowMinutes(nowMinutesLocal());   // reads the wall clock
 *   setNow(new Date());                 // reads it again
 *
 * Two reads, so the pair can straddle a minute boundary and disagree — the
 * line drawn a minute away from the status that decided the row is late. And
 * nothing forced them to be ticked together in the first place; a third
 * caller of one setter would have been enough to split them for good.
 *
 * One state, one read, and the minutes derived from it. Local time on
 * purpose: both consumers are about the day the user is looking at.
 */
export function useMinuteClock(): { now: Date; nowMinutes: number } {
  const [now, setNow] = useState(() => new Date());

  // Cleared on unmount so it never leaks across section changes.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const nowMinutes = useMemo(
    () => now.getHours() * 60 + now.getMinutes(),
    [now],
  );

  return { now, nowMinutes };
}
