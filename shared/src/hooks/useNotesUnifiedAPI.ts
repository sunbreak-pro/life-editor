/*
 * DU-G G3: alias re-export of `useNotesAPI` under the Unified naming.
 * The runtime is identical (legacy Bridge already routes to the Unified
 * service, G1). G4 will replace this alias with a body that calls the
 * *Unified DataService methods directly + retire `useNotesAPI`. Public
 * import path stays stable across the swap.
 */
export {
  useNotesAPI as useNotesUnifiedAPI,
  type UseNotesAPIOptions as UseNotesUnifiedAPIOptions,
  type NoteSortDirection,
} from "./useNotesAPI";
