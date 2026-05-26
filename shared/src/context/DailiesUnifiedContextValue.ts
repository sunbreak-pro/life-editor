import { createContext } from "react";
import type { useDailyAPI } from "../hooks/useDailyAPI";

/*
 * DU-G G3: Pattern A Context for the Daily domain in its "Unified naming"
 * surface. The runtime value shape is identical to the legacy
 * `DailyContextValue` — only the Context instance is distinct so a host
 * can mount the legacy DailyProvider and DailiesUnifiedProvider side-by-
 * side without context collision during the transition (G3/G4).
 *
 * Naming note: the Unified surface uses the plural `Dailies` to match the
 * Unified service (`SupabaseDailiesUnifiedService`, `dailies_payload`).
 * Legacy used singular `Daily*`; the divergence is intentional and will
 * stabilise on `Dailies*` once G4 retires the legacy names.
 *
 * Internals (G3): the Provider still calls `useDailyAPI`, which
 * dispatches through legacy `DataService` method names. The Bridge
 * `SupabaseDailyService` (G2) routes them to
 * `SupabaseDailiesUnifiedService`. G4 will rewrite the hook to call the
 * *Unified DataService methods directly; the public Context stays stable.
 */
export type DailiesUnifiedContextValue = ReturnType<typeof useDailyAPI>;

export const DailiesUnifiedContext =
  createContext<DailiesUnifiedContextValue | null>(null);
