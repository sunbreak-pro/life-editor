import { useCallback, useEffect, useRef } from "react";
import { TourContext } from "../context/TourContextValue";
import { createOptionalContextHook } from "./createOptionalContextHook";

const useTourOptional = createOptionalContextHook(TourContext);

/**
 * Report that the user performed a tour-advancing action (#1124).
 *
 * Returns a REPORTER, not the context. Two reasons, and both are about the
 * call sites: they are ordinary write handlers that happen to also tell the
 * tour, and they should neither depend on the tour existing nor re-render when
 * it moves.
 *
 * OPTIONAL, unlike `useTourContext`. That hook throws outside the Provider
 * because a consumer of the tour's STATE outside it is a wiring mistake; a
 * producer of an action is the opposite case. Reporting is fire-and-forget
 * into a coach that may not be listening — under test (`KanbanView` renders
 * bare in web/tests), in a host that mounts a screen without the shell, or
 * simply while no tour is running. None of those should crash a save.
 *
 * STABLE FOR THE LIFETIME OF THE COMPONENT. `notifyAction` is rebuilt whenever
 * the current step changes, so returning it directly would invalidate every
 * handler wrapped around it once per step — handlers that are themselves deps
 * of large memoised trees (CalendarTab's create flow, the Kanban board). The
 * ref keeps the identity fixed and reads the live function at call time, the
 * same shape TourContext.tsx uses for its own probe.
 */
export function useTourAction(): (event: string) => void {
  const tour = useTourOptional();
  const notifyRef = useRef(tour?.notifyAction);

  // Synced in an effect rather than during render (react-hooks/refs). The
  // `useRef` seed above already holds the first render's value, and effects
  // run before any handler can fire, so no caller reads a stale one.
  useEffect(() => {
    notifyRef.current = tour?.notifyAction;
  });

  return useCallback((event: string) => {
    notifyRef.current?.(event);
  }, []);
}
