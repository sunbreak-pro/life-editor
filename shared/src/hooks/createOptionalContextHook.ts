import { useContext, type Context } from "react";

/**
 * Optional Context hook factory — the Mobile-safe counterpart of
 * `createContextHook`. Verbatim port of
 * `frontend/src/hooks/createOptionalContextHook.ts`.
 *
 * `createContextHook` THROWS when used outside its Provider (the Provider is
 * always mounted). Mobile 省略 Providers (roster = CLAUDE.md §2) are meant to
 * stay unmounted on iOS/Android, so shared components that may render there
 * must read the context through this variant and `if (!ctx) return null`
 * (vision/coding-principles.md §4).
 *
 * Also used for genuinely optional ambient contexts on every platform — e.g.
 * `useUndoRedoOptional`, which lets a domain Provider auto-connect to the
 * app-wide undo stack when one is mounted and no-op when it isn't (#304).
 */
export function createOptionalContextHook<T>(
  context: Context<T | null>,
): () => T | null {
  return () => useContext(context);
}
