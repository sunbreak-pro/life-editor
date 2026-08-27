import { TourContext } from "../context/TourContextValue";
import { createContextHook } from "./createContextHook";

/**
 * Read the tutorial tour (#1122). Throws outside `TourProvider` — the tour is
 * a REQUIRED global Provider, so a null here is a wiring mistake rather than a
 * platform the Provider is omitted on (contrast `useShortcutConfig`).
 */
export const useTourContext = createContextHook(TourContext, "useTourContext");
