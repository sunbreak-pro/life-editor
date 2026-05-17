import { useContext, type Context } from "react";

/**
 * Optional Context hook factory — the Mobile-safe counterpart of
 * `createContextHook`. Verbatim port of
 * `frontend/src/hooks/createOptionalContextHook.ts`.
 *
 * `createContextHook` THROWS when used outside its Provider (Desktop —
 * the Provider is always mounted). Mobile 省略 Providers (CalendarTags /
 * Audio / ScreenLock / FileExplorer / ShortcutConfig — CLAUDE.md §2) are
 * NOT mounted on iOS/Android, so shared components that may render there
 * must read the context through this variant and `if (!ctx) return null`
 * (vision/coding-principles.md §4).
 */
export function createOptionalContextHook<T>(
  context: Context<T | null>,
): () => T | null {
  return () => useContext(context);
}
