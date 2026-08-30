import { useCallback, useEffect } from "react";
import { useNotesUnifiedContext, type DataService } from "@life-editor/shared";
import { useItemLinkTargets } from "../useItemLinkTargets";
import { useInlineItemLinks } from "../../hooks/useInlineItemLinks";

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
}: {
  dataService?: DataService;
  pendingSelectNoteId?: string | null;
  onConsumePendingSelect?: () => void;
}) {
  const notes = useNotesUnifiedContext();
  // "[[" → item_links, shared with Todos and Daily (#776). The edge write and
  // the save-time delete-sync live there; this host only names itself for the
  // console and hands both callbacks to its body editors.
  const { mirrorInlineLink, syncSavedBody } = useInlineItemLinks("NotesView");

  // Live title lookup for the LinkPanel's own rows, from the domain this host
  // owns. The panel asks this FIRST and the cross-role pool second: a note
  // renamed a second ago is right here, where the pool is a snapshot.
  // #749 dropped the "[note] " prefix — the row carries a role icon now, so
  // spelling the role into the title said it twice.
  //
  // #1292: a DELETED note is deliberately not answered here. The list keeps
  // soft-deleted rows (that is what Trash restores from), so answering for one
  // would hand the panel a live-looking title for an item that is gone — and
  // the panel's "deleted" reading comes from the pool, which this lookup wins
  // over. Falling through leaves the pool to say so.
  const resolveTitle = (id: string): string | undefined => {
    const n = notes.notes.find((nn) => nn.id === id);
    if (!n || n.isDeleted) return undefined;
    return n.title || undefined;
  };

  // Cross-domain item pool (notes + dailies + todos). Feeds BOTH the editor's
  // "[[" autocomplete and — since #749 — the LinkPanel's search picker, which
  // is why a Note→Todo link can now be made and read by title. A loader, not a
  // list: nothing is fetched until a surface actually opens (#430).
  const loadLinkTargets = useItemLinkTargets(dataService);

  /*
   * A link click from another tab lands here with a pending note id — select
   * it once (the async note load resolves selectedNote afterwards), then clear.
   *
   * Selecting is now the WHOLE handoff. It used to also report the id back to
   * the host (`onPendingSelected`), because the mobile detail sheet tracked a
   * note id of its own and would otherwise keep the old note's chrome over a
   * body that never resolved (#475). #876 retired that sheet: every surface
   * reads `selectedNote`, so moving the selection moves all of them.
   */
  useEffect(() => {
    if (!pendingSelectNoteId) return;
    notes.setSelectedNoteId(pendingSelectNoteId);
    onConsumePendingSelect?.();
    // notes.setSelectedNoteId / onConsumePendingSelect are stable enough;
    // rerun only when a new pending id arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSelectNoteId]);

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
    handleResolvedLinkInserted: mirrorInlineLink,
    handleBodySaved: syncSavedBody,
    handleCreateNoteForLink,
  };
}

/** The "[[" wiring the host hands to each surface's body editor. */
export type NoteLinking = ReturnType<typeof useNoteLinking>;
