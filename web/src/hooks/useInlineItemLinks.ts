import { useCallback } from "react";
import { useWikiTagsUnifiedContext } from "@life-editor/shared";

/*
 * The one copy of "a `[[ ]]` link in a body is an edge in item_links" (#776).
 *
 * Notes, Todos and Daily each grew their own version of this: Notes and Todos
 * were verbatim copies whose only difference was the console tag (and the todo
 * hook still named `[KanbanView]` from where it was copied), while Daily had
 * the same three steps buried inside its park / flush machinery. A fourth
 * editing surface would have needed a fourth copy — which is exactly what the
 * todo hook's own header said it existed to prevent.
 *
 * Three steps, and all three surfaces need every one of them:
 *
 *   1. Duplicate guard against the bulk cache. A pre-existing MANUAL edge for
 *      the same pair therefore keeps its manual origin — and with it, its
 *      immunity to the delete-sync below.
 *   2. The edge is written with origin "inline", which is what makes it a
 *      candidate for removal when its text link goes away.
 *   3. After a save, `syncInlineLinks` soft-deletes the inline-origin edges
 *      whose "[[ ]]" is no longer in the saved text (#372). Fire-and-forget
 *      beside the save — a failed sync only leaves a stale edge the next save
 *      retries.
 *
 * What stays with the host is WHEN these run: Notes and Todos link from a row
 * that already exists, so they call straight through; Daily's row is minted by
 * the save that carries the link, so it parks insertions by date and calls
 * `mirrorInlineLink` from the flush (see DailyView).
 *
 * `hostTag` is the surface's own name for its console errors, passed in rather
 * than written here — a tag baked into shared code is how `[KanbanView]` ended
 * up inside a hook called `useTodoLinking`.
 */
export function useInlineItemLinks(hostTag: string) {
  const { createItemLink, getLinksForItem, syncInlineLinks } =
    useWikiTagsUnifiedContext();

  /** Mirror a resolved "[[" link as an edge from `fromId` to the target. */
  const mirrorInlineLink = useCallback(
    (fromId: string, targetId: string) => {
      // Self-links are skipped (createItemLink rejects them anyway).
      if (!fromId || fromId === targetId) return;
      const already = getLinksForItem(fromId).outgoing.some(
        (l) => !l.isDeleted && l.toItemId === targetId,
      );
      if (already) return;
      void createItemLink(fromId, targetId, "inline").catch((e) =>
        console.error(`[${hostTag}] item link upsert failed`, e),
      );
    },
    [getLinksForItem, createItemLink, hostTag],
  );

  /** Drop the inline-origin edges the just-saved body no longer carries. */
  const syncSavedBody = useCallback(
    (fromId: string, content: string) => {
      void syncInlineLinks(fromId, content).catch((e) =>
        console.error(`[${hostTag}] inline link delete-sync failed`, e),
      );
    },
    [syncInlineLinks, hostTag],
  );

  return { mirrorInlineLink, syncSavedBody };
}

/** The inline-link wiring a host shares with its body editor. */
export type InlineItemLinks = ReturnType<typeof useInlineItemLinks>;
