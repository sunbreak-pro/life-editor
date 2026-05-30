/*
 * DU-G G3: alias re-export of `useDailyAPI` under the Unified naming.
 * The runtime is identical (legacy Bridge already routes to the Unified
 * service, G2). G4 will replace this alias with a body that calls the
 * *Unified DataService methods directly + retire `useDailyAPI`. Public
 * import path stays stable across the swap.
 */
export {
  useDailyAPI as useDailiesUnifiedAPI,
  type UseDailyAPIOptions as UseDailiesUnifiedAPIOptions,
} from "./useDailyAPI";
