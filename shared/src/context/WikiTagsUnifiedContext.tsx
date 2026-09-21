import { useEffect, useRef, type ReactNode } from "react";
import {
  useWikiTagsUnifiedAPI,
  type UseWikiTagsUnifiedAPIOptions,
} from "../hooks/useWikiTagsUnifiedAPI";
import { useUndoRedoOptional } from "../hooks/useUndoRedoContext";
import { WikiTagsUnifiedContext } from "./WikiTagsUnifiedContextValue";

/*
 * Pattern A Provider for DU-C+ unified WikiTag state. Mounted by the
 * host App.tsx after Sync (the hook reads `useSyncContext`) and any
 * items_meta-owning Providers (Todos / Events / Routine / Notes /
 * Daily) — assignments / links may reference items from any of those
 * roles, so this Provider is the "last sibling" of that group.
 *
 * `userId` is supplied by the host (read from SupabaseAuth) — the hook
 * uses it as the FK target for inserts. The shared hook never reaches a
 * module singleton (CLAUDE.md §6.4).
 *
 * Auto-connects to the ambient global UndoRedo stack (#1667 put tag assign /
 * unassign on it; #1800 moved the pickup here). The other five domain
 * Providers — ScheduleItems / TodoTree / NotesUnified / DailiesUnified /
 * Routine — all read `useUndoRedoOptional()` at this level, and tags read it
 * inside the API hook instead. Behaviour matched, but the place to look did
 * not: a reader checking "is this domain wired?" reads the Providers. An
 * explicit `undoRedo` prop still wins; with no UndoRedoProvider at all the
 * hook records no history, which is what keeps a standalone mount working.
 */
export function WikiTagsUnifiedProvider({
  children,
  ...options
}: { children: ReactNode } & UseWikiTagsUnifiedAPIOptions) {
  const undoRedo = useUndoRedoOptional();
  const value = useWikiTagsUnifiedAPI({
    ...options,
    undoRedo: options.undoRedo ?? undoRedo ?? undefined,
  });

  /*
   * Unmount-EXPIRE via ref (#1727), the same shape as the five. It drops only
   * this domain's SNAPSHOT commands, and tag commands name their row by id —
   * so today this expires nothing, on purpose: an assignment made in Materials
   * is still reversible after walking to Connect. What it buys is that a
   * future snapshot-shaped tag command (a bulk write folded into one entry,
   * the #1667 follow-up) cannot outlive the provider that took it without
   * someone deciding to let it.
   */
  const undoRedoRef = useRef(undoRedo);
  // Mirrored in an effect, not during render (#505): a render React discards
  // must not leave its write behind.
  useEffect(() => {
    undoRedoRef.current = undoRedo;
  });
  const hasExplicitUndoRedo = options.undoRedo != null;
  useEffect(() => {
    if (hasExplicitUndoRedo) return;
    return () => undoRedoRef.current?.expireDomain("tags");
  }, [hasExplicitUndoRedo]);

  return (
    <WikiTagsUnifiedContext.Provider value={value}>
      {children}
    </WikiTagsUnifiedContext.Provider>
  );
}
