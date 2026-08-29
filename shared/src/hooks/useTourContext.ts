import { TourContext } from "../context/TourContextValue";
import { createContextHook } from "./createContextHook";
import { createOptionalContextHook } from "./createOptionalContextHook";

/**
 * Read the tutorial tour (#1122). Throws outside `TourProvider` — the tour is
 * a REQUIRED global Provider, so a null here is a wiring mistake rather than a
 * platform the Provider is omitted on (contrast `useShortcutConfig`).
 */
export const useTourContext = createContextHook(TourContext, "useTourContext");

/**
 * Null-safe variant, for the sections that REPORT to the tour (#1125).
 *
 * The Provider is still required of the app — this is not a Mobile 省略 one.
 * What it lets a section skip is a Provider it never otherwise needed: a view
 * that calls `notifyAction` to say "the user did the thing" is not a tour
 * consumer in any meaningful sense, and the throwing hook would make the tour
 * a mount-time dependency of every such view (and of every suite that renders
 * one in isolation). The same reasoning as `useUndoRedoOptional`: connect to
 * the ambient stack when one is there, no-op when it is not.
 */
export const useTourContextOptional = createOptionalContextHook(TourContext);
