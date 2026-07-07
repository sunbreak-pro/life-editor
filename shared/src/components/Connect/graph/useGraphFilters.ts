import { useCallback, useMemo, useState } from "react";
import type { GraphNodeType, GraphSnapshot } from "./graph-types";
import {
  DEFAULT_FILTER_STATE,
  DEFAULT_TYPE_TOGGLES,
  activeFilterCount as countActive,
  applyFilters,
  type FilterState,
} from "./graph-filters";
import { DEFAULT_FORCES, type ForceParams } from "./useGraphSimulation";

export interface UseGraphFiltersResult {
  filter: FilterState;
  forces: ForceParams;
  setForces: (f: ForceParams) => void;
  showLabels: boolean;
  setShowLabels: (v: boolean) => void;
  setSearch: (q: string) => void;
  toggleType: (type: GraphNodeType) => void;
  toggleTag: (tagNodeIdValue: string) => void;
  clearTags: () => void;
  setLocalDepth: (d: number) => void;
  setShowOrphans: (v: boolean) => void;
  clearAll: () => void;
  /** filtered graph + the search-match set for the green glow */
  filtered: GraphSnapshot;
  searchMatchSet: Set<string> | null;
  activeFilterCount: number;
}

export function useGraphFilters(
  snapshot: GraphSnapshot,
  selectedId: string | null,
): UseGraphFiltersResult {
  const [search, setSearchRaw] = useState("");
  const [activeTypes, setActiveTypes] = useState(DEFAULT_TYPE_TOGGLES);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [localDepth, setLocalDepthRaw] = useState(0);
  const [showOrphans, setShowOrphansRaw] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [forces, setForces] = useState<ForceParams>(DEFAULT_FORCES);

  // Local graph only kicks in when a node is selected AND depth > 0.
  const localFocusId = localDepth > 0 ? selectedId : null;

  const filter: FilterState = useMemo(
    () => ({
      search,
      activeTypes,
      activeTags,
      localFocusId,
      localDepth,
      showOrphans,
    }),
    [search, activeTypes, activeTags, localFocusId, localDepth, showOrphans],
  );

  const { filtered, searchMatchSet } = useMemo(() => {
    const r = applyFilters(snapshot, filter);
    return { filtered: r.snapshot, searchMatchSet: r.searchMatchSet };
  }, [snapshot, filter]);

  const toggleType = useCallback((type: GraphNodeType) => {
    setActiveTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  }, []);

  const toggleTag = useCallback((id: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearTags = useCallback(() => setActiveTags(new Set()), []);

  const clearAll = useCallback(() => {
    setSearchRaw("");
    setActiveTypes(DEFAULT_TYPE_TOGGLES);
    setActiveTags(new Set());
    setLocalDepthRaw(0);
    setShowOrphansRaw(true);
  }, []);

  const activeFilterCount = useMemo(
    () => countActive({ ...filter, localFocusId: selectedId }),
    [filter, selectedId],
  );

  return {
    filter,
    forces,
    setForces,
    showLabels,
    setShowLabels,
    setSearch: setSearchRaw,
    toggleType,
    toggleTag,
    clearTags,
    setLocalDepth: setLocalDepthRaw,
    setShowOrphans: setShowOrphansRaw,
    clearAll,
    filtered,
    searchMatchSet,
    activeFilterCount,
  };
}

export { DEFAULT_FILTER_STATE };
