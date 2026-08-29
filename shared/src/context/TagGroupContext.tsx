import type { ReactNode } from "react";
import {
  useTagGroupsAPI,
  type UseTagGroupsAPIOptions,
} from "../hooks/useTagGroupsAPI";
import { TagGroupContext } from "./TagGroupContextValue";

/**
 * Pattern A Provider (CLAUDE.md §6.3). Takes `UseTagGroupsAPIOptions` props so
 * the host injects the DataService (the shared hook never reaches a module
 * singleton — CLAUDE.md §6.4). Must sit inside a Sync Provider (reads
 * `useSyncContext`).
 *
 * Took `CalendarProvider`'s slot in the Schedule section chain (#1173), which
 * is why there is no Optional variant: the Calendar it replaced was mounted at
 * both widths, and so is this. The narrow layout draws no filter control, but
 * the Provider is cheap and keeping it unconditional means the Schedule chain
 * has no width-dependent shape to reason about.
 *
 * Scope: tag-group CRUD.
 */
export function TagGroupProvider({
  children,
  ...options
}: { children: ReactNode } & UseTagGroupsAPIOptions) {
  const tagGroupState = useTagGroupsAPI(options);
  return (
    <TagGroupContext.Provider value={tagGroupState}>
      {children}
    </TagGroupContext.Provider>
  );
}
