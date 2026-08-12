import { useCallback, useEffect } from "react";
import {
  useNotesUnifiedContext,
  useWikiTagsUnifiedContext,
  type DataService,
} from "@life-editor/shared";
import { useItemLinkTargets } from "../useItemLinkTargets";

/*
 * Link half of the Notes host (extracted from NotesView.tsx — hooks split,
 * zero behavior change). Owns the LinkPanel candidate pool, the "[[" wiki-link
 * target loader with its editor callbacks, and the cross-tab pending-selection
 * handoff (a link clicked in another tab lands here as a note id to select).
 */

export function useNoteLinking({
  dataService,
  pendingSelectNoteId,
  onConsumePendingSelect,
  onPendingSelected,
}: {
  dataService?: DataService;
  pendingSelectNoteId?: string | null;
  onConsumePendingSelect?: () => void;
  /**
   * The pending handoff moved the selection to this id. Selecting is not enough
   * for surfaces the HOST keys on separately — the mobile detail sheet tracks
   * its own note id — so the host follows them here (#475).
   */
  onPendingSelected?: (id: string) => void;
}) {
  const notes = useNotesUnifiedContext();
  const { createItemLink, getLinksForItem, syncInlineLinks } =
    useWikiTagsUnifiedContext();

  // Live title lookup for the LinkPanel's own rows, from the domain this host
  // owns. The panel asks this FIRST and the cross-role pool second: a note
  // renamed a second ago is right here, where the pool is a snapshot.
  // #749 dropped the "[note] " prefix — the row carries a role icon now, so
  // spelling the role into the title said it twice.
  const resolveTitle = (id: string): string | undefined => {
    const n = notes.notes.find((nn) => nn.id === id);
    if (!n) return undefined;
    return n.title || undefined;
  };

  // Cross-domain item pool (notes + dailies + tasks). Feeds BOTH the editor's
  // "[[" autocomplete and — since #749 — the LinkPanel's search picker, which
  // is why a Note→Task link can now be made and read by title. A loader, not a
  // list: nothing is fetched until a surface actually opens (#430).
  const loadLinkTargets = useItemLinkTargets(dataService);

  // A link click from another tab lands here with a pending note id — select
  // it once (the async note load resolves selectedNote afterwards), then clear.
  useEffect(() => {
    if (!pendingSelectNoteId) return;
    notes.setSelectedNoteId(pendingSelectNoteId);
    onPendingSelected?.(pendingSelectNoteId);
    onConsumePendingSelect?.();
    // notes.setSelectedNoteId / onConsumePendingSelect / onPendingSelected are
    // stable enough; rerun only when a new pending id arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSelectNoteId]);

  // Mirror a resolved "[[" link into the item_links graph (Connect / backlinks)
  // as an edge from the CURRENT note to the target, marked origin "inline" so
  // the save-time delete-sync (#372, handleBodySaved below) may remove it when
  // the text link goes away — manual LinkPanel edges stay untouched.
  // Duplicate-guarded against the bulk cache; a pre-existing manual edge for
  // the same pair therefore keeps its manual origin (and its immunity).
  // Self-links are skipped (createItemLink rejects them anyway).
  const handleResolvedLinkInserted = useCallback(
    (fromId: string, targetId: string) => {
      if (!fromId || fromId === targetId) return;
      const already = getLinksForItem(fromId).outgoing.some(
        (l) => !l.isDeleted && l.toItemId === targetId,
      );
      if (already) return;
      void createItemLink(fromId, targetId, "inline").catch((e) =>
        console.error("[NotesView] item link upsert failed", e),
      );
    },
    [getLinksForItem, createItemLink],
  );

  // #372: after a body save, soft-delete the inline-origin edges whose "[[ ]]"
  // link is no longer in the saved text. Fire-and-forget beside the save —
  // a failed sync only leaves a stale edge the next save retries.
  const handleBodySaved = useCallback(
    (fromId: string, content: string) => {
      void syncInlineLinks(fromId, content).catch((e) =>
        console.error("[NotesView] inline link delete-sync failed", e),
      );
    },
    [syncInlineLinks],
  );

  // "[[" create-a-note-and-link. select:false keeps the editor on the note the
  // user is writing in (createNote otherwise switches selection, remounting the
  // editor mid-insert); skipUndo avoids polluting the undo stack for a link.
  const handleCreateNoteForLink = useCallback(
    async (label: string): Promise<{ id: string } | null> => {
      const id = notes.createNote(label, { select: false, skipUndo: true });
      return id ? { id } : null;
    },
    [notes],
  );

  return {
    resolveTitle,
    loadLinkTargets,
    handleResolvedLinkInserted,
    handleBodySaved,
    handleCreateNoteForLink,
  };
}

/** The "[[" wiring the host hands to each surface's body editor. */
export type NoteLinking = ReturnType<typeof useNoteLinking>;
