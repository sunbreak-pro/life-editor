import { useCallback, useMemo, useRef, useState } from "react";

/**
 * "One operation per id at a time", claimed synchronously (#434, extracted
 * from the #407 guard in CalendarTab's mutation layer).
 *
 * The motivating case is the Event→Repeats conversion. Its branch is chosen
 * by `selected.routineId == null`, but the conversion and the optimistic
 * routineId patch land asynchronously — a second click inside that window
 * would convert the SAME seed again and mint a second routine whose loser
 * twin survives unreferenced, generating occurrences forever (the #407
 * zombie).
 *
 * Two properties matter, and they pull in opposite directions:
 *
 * - The claim must be **synchronous**. Two clicks can land in one tick, and
 *   a `useState` write is batched — both clicks would read the pre-update
 *   value and both would proceed. So the authority is a ref.
 * - The claim must be **render-visible**, or the UI cannot show that it is
 *   busy and the ignored click looks like a dead button. So the ref is
 *   mirrored into state.
 *
 * `begin` folds the check and the claim into one call and returns false when
 * the id was already claimed, so callers cannot reintroduce a check-then-act
 * gap by testing and claiming in two statements.
 *
 * `inFlightIds` is for rendering only and may lag the ref by one render.
 * Never branch a write path on it — use the `begin` return value.
 *
 * Every `begin` that returns true must be matched by an `end`, and the caller
 * is responsible for putting that `end` somewhere no exit path can skip (a
 * `finally`): a leaked claim locks the id for the rest of the session.
 */
export function useInFlightGuard(): {
  begin: (id: string) => boolean;
  end: (id: string) => void;
  isInFlight: (id: string) => boolean;
  inFlightIds: string[];
} {
  const idsRef = useRef<Set<string>>(new Set());
  const [inFlightIds, setInFlightIds] = useState<string[]>([]);

  const begin = useCallback((id: string) => {
    if (idsRef.current.has(id)) return false;
    idsRef.current.add(id);
    setInFlightIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    return true;
  }, []);

  const end = useCallback((id: string) => {
    if (!idsRef.current.delete(id)) return;
    setInFlightIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const isInFlight = useCallback((id: string) => idsRef.current.has(id), []);

  return useMemo(
    () => ({ begin, end, isInFlight, inFlightIds }),
    [begin, end, isInFlight, inFlightIds],
  );
}
