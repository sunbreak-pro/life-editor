import { DailiesUnifiedContext } from "../context/DailiesUnifiedContextValue";
import { createContextHook } from "./createContextHook";

/**
 * DU-G G3: Pattern A consumer hook for the Daily "Unified naming"
 * Context. Throws if used outside a `DailiesUnifiedProvider`. See
 * `DailiesUnifiedContextValue.ts` for the G3/G4 transition rationale.
 */
export const useDailiesUnifiedContext = createContextHook(
  DailiesUnifiedContext,
  "useDailiesUnifiedContext",
);
