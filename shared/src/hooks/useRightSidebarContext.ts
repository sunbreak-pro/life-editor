import { createContextHook } from "./createContextHook";
import { createOptionalContextHook } from "./createOptionalContextHook";
import { RightSidebarContext } from "../context/RightSidebarContextValue";

/*
 * RightSidebar context hooks — Pattern A 3/3 (CLAUDE.md §6.3). App Shell Turn 2.
 *
 * useRightSidebarContext — throwing variant for the panel/drawer/toggle that
 *   the host always mounts inside the Provider.
 * useRightSidebarOptional — null-safe variant for RightSidebarPortal, which a
 *   section body may render even when no Provider is mounted (existing tests /
 *   standalone renders). Returns null outside the Provider so those callers can
 *   `if (!ctx) return null` (vision/coding-principles.md §4).
 */
export const useRightSidebarContext = createContextHook(
  RightSidebarContext,
  "useRightSidebarContext",
);

export const useRightSidebarOptional =
  createOptionalContextHook(RightSidebarContext);
