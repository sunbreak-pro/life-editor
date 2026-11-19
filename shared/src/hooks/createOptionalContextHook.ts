import { useContext, type Context } from "react";

/**
 * Optional Context hook factory — the Mobile-safe counterpart of
 * `createContextHook`. Verbatim port of
 * `frontend/src/hooks/createOptionalContextHook.ts`.
 *
 * `createContextHook` THROWS when used outside its Provider (the Provider is
 * always mounted). A Provider that a tree may legitimately lack — such as
 * ShortcutConfig in a component rendered without AppProviders — is read
 * through this variant, and the consumer does `if (!ctx) return null`
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
