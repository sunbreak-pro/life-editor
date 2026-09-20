import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { NoteNode } from "../types/note";
import type { DataService } from "../services/DataService";
import {
  reportNoteWriteError,
  type NoteWriteErrorHandler,
} from "./notesWriteError";
import { generateId } from "../utils/generateId";
import { afterSettled } from "../utils/undoRedo/pendingWrite";
import type { UndoRedoLike } from "./useTodoTreeHistory";
import { buildNoteNode, collectNoteSubtree } from "./notesUnifiedHelpers";
import {
  setNotesSelection,
  clearNotesSelection,
} from "../state/materialsSelectionStore";
import { recordNoteOpened } from "../state/recentNotesStore";

/**
 * Create / update / soft-delete / pin for useNotesUnifiedAPI (#587 split).
 * Verbatim moves — the write paths still stamp optimistic client clocks and
 * report them to the hydration ledger (`markHydrated` / `markLocalWrite` /
 * `trackWrite`, #607) exactly as before; only the plumbing is injected now.
 */

export interface UseNotesUnifiedCRUDParams {
  ds: DataService;
  push: UndoRedoLike["push"];
  notesRef: MutableRefObject<NoteNode[]>;
  selectedNoteIdRef: MutableRefObject<string | null>;
  setNotes: Dispatch<SetStateAction<NoteNode[]>>;
  setDeletedNotes: Dispatch<SetStateAction<NoteNode[]>>;
  /** The RAW state setter — a create must not take the hydrate-first path. */
  setSelectedNoteId: Dispatch<SetStateAction<string | null>>;
  markHydrated: (id: string) => void;
  markLocalWrite: (id: string) => void;
  trackWrite: (id: string, write: Promise<unknown>) => Promise<unknown>;
  /**
   * #1761 — told when an already-applied write is refused, so the host can say
   * so out loud. Optional: with no handler this is the old warn-only behaviour.
   */
  onWriteError?: NoteWriteErrorHandler;
}

export function useNotesUnifiedCRUD(params: UseNotesUnifiedCRUDParams) {
  const {
    ds,
    push,
    notesRef,
    selectedNoteIdRef,
    setNotes,
    setDeletedNotes,
    setSelectedNoteId,
    markHydrated,
    markLocalWrite,
    trackWrite,
    onWriteError,
  } = params;

  const createNote = useCallback(
    (
      title?: string,
      opts?: {
        skipUndo?: boolean;
        parentId?: string | null;
        initialContent?: string;
        /**
         * Whether to select the new note (default true). The "[[" link-create
         * flow passes false so creating a note to link to does NOT switch the
         * editor away from the note the user is currently writing in.
         */
        select?: boolean;
      },
    ) => {
      const id = generateId("note");
      const now = new Date().toISOString();
      const resolvedParentId = opts?.parentId ?? null;
      const resolvedContent = opts?.initialContent ?? "";
      const newNote: NoteNode = {
        ...buildNoteNode(id, title || "Untitled", resolvedParentId, now),
        content: resolvedContent,
      };
      setNotes((prev) => [newNote, ...prev]);
      // M1: the body is known locally; mark loaded so a re-select does NOT
      // re-fetch (which could race the still-in-flight content write and
      // clobber the local body with an empty server row).
      markHydrated(id);
      // #607: `now` above is a client clock and the INSERT will come back with
      // the server's, so a brand-new note is in exactly the same position as an
      // edited one — the first reload would drop the body out from under the
      // editor the user just started typing in.
      markLocalWrite(id);
      // #285 background create (select:false) must not switch the editor —
      // and must not retarget the #282 restore either, so the store write
      // stays inside the same guard.
      if (opts?.select !== false) {
        setSelectedNoteId(id);
        setNotesSelection(id); // #282: restore the just-created note after a tab switch
        recordNoteOpened(id); // #1149: a fresh note counts as opened
      }
      const writeCreate = (): Promise<unknown> =>
        trackWrite(
          id,
          ds
            .createNoteUnified(
              buildNoteNode(id, newNote.title, resolvedParentId, now),
            )
            .then(() => {
              if (resolvedContent) {
                return ds.updateNoteUnified(id, { content: resolvedContent });
              }
            }),
        );
      /*
       * #1682 — the undo below waits on THIS promise before deleting.
       *
       * The create is still in flight when the command is pushed. Without the
       * wait, a fast Ctrl+Z deleted a row the INSERT had not written yet: the
       * delete found nothing, the INSERT landed a moment later, and the note
       * was back on screen with the undo already spent.
       */
      const landed = writeCreate();
      void landed.catch((e) => reportNoteWriteError("create", e, onWriteError));

      if (!opts?.skipUndo) {
        push("note", {
          label: "createNote",
          undo: async () => {
            // Local first — the screen must answer the keystroke now, not
            // after a round trip. Only the WRITE queues.
            setNotes((p) => p.filter((n) => n.id !== id));
            if (selectedNoteIdRef.current === id) {
              setSelectedNoteId(null);
              clearNotesSelection(); // #282: don't restore a removed note
            }
            await afterSettled(landed);
            // No catch: a delete the server refused is a failed undo, and the
            // manager is the one that tells the user so.
            await ds.permanentDeleteNoteUnified(id);
          },
          redo: () => {
            setNotes((p) => [newNote, ...p]);
            markHydrated(id);
            markLocalWrite(id); // #607
            setSelectedNoteId(id);
            setNotesSelection(id); // #282
            recordNoteOpened(id); // #1149
            return writeCreate().then(() => {});
          },
        });
      }

      return id;
    },
    [
      ds,
      push,
      markHydrated,
      markLocalWrite,
      trackWrite,
      setNotes,
      setSelectedNoteId,
      selectedNoteIdRef,
      onWriteError,
    ],
  );

  const updateNote = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<NoteNode, "title" | "content" | "isPinned" | "color" | "icon">
      >,
    ) => {
      // Don't push undo for content-only updates (TipTap handles its own
      // undo internally).
      const isContentOnly =
        Object.keys(updates).length === 1 && "content" in updates;

      if (!isContentOnly) {
        const prev = notesRef.current.find((n) => n.id === id);
        if (prev) {
          const prevValues: Partial<
            Pick<NoteNode, "title" | "isPinned" | "color" | "icon">
          > = {};
          if ("title" in updates) prevValues.title = prev.title;
          if ("isPinned" in updates) prevValues.isPinned = prev.isPinned;
          if ("color" in updates) prevValues.color = prev.color;
          if ("icon" in updates) prevValues.icon = prev.icon;

          push("note", {
            label: "updateNote",
            undo: () => {
              const now = new Date().toISOString();
              markLocalWrite(id); // #607 — same client-clock stamp as below
              setNotes((p) =>
                p.map((n) =>
                  n.id === id ? { ...n, ...prevValues, updatedAt: now } : n,
                ),
              );
              // #1682: returned, not swallowed — a rejected patch is a failed
              // undo, and the manager keeps the command so it can be retried.
              return trackWrite(id, ds.updateNoteUnified(id, prevValues)).then(
                () => {},
              );
            },
            redo: () => {
              const now = new Date().toISOString();
              markLocalWrite(id); // #607
              setNotes((p) =>
                p.map((n) =>
                  n.id === id ? { ...n, ...updates, updatedAt: now } : n,
                ),
              );
              return trackWrite(id, ds.updateNoteUnified(id, updates)).then(
                () => {},
              );
            },
          });
        }
      }

      const now = new Date().toISOString();
      // M1: an edited body is authoritative locally — keep it marked loaded
      // so a later reselect/reload doesn't drop back to the light "".
      if ("content" in updates) markHydrated(id);
      // #607: the `now` stamped below is a client clock, so the reload this
      // write's own echo triggers must not read the moved `updatedAt` as
      // "someone else touched it" and drop the body under the open editor.
      markLocalWrite(id);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, ...updates, updatedAt: now } : n,
        ),
      );
      void trackWrite(
        id,
        ds
          .updateNoteUnified(id, updates)
          .catch((e) => reportNoteWriteError("update", e, onWriteError)),
      );
    },
    [
      ds,
      push,
      markHydrated,
      markLocalWrite,
      trackWrite,
      notesRef,
      setNotes,
      onWriteError,
    ],
  );

  const softDeleteNote = useCallback(
    (id: string, opts?: { skipUndo?: boolean }) => {
      // `ds.softDeleteNoteUnified` only flips is_deleted on the single row.
      // For a note that has nested children that would orphan every
      // descendant, so we collect the whole subtree here and soft-delete it
      // as a unit (deepest-first → DataService can stay single-row). For a
      // leaf note `subtree` is just `[target]`, so leaf behaviour is
      // unchanged.
      const all = notesRef.current;
      const target = all.find((n) => n.id === id);
      if (!target) return;

      const subtree = collectNoteSubtree(all, id);
      const subtreeIds = new Set(subtree.map((n) => n.id));

      setNotes((prev) => prev.filter((n) => !subtreeIds.has(n.id)));
      if (
        selectedNoteIdRef.current !== null &&
        subtreeIds.has(selectedNoteIdRef.current)
      ) {
        setSelectedNoteId(null);
        clearNotesSelection(); // #282: don't restore a soft-deleted note
      }
      // Surface the removed nodes in Trash immediately (the deepest-first
      // order keeps ancestors above descendants once prepended). restore /
      // permanentDelete already keep deletedNotes locally consistent.
      setDeletedNotes((prev) => {
        const known = new Set(prev.map((n) => n.id));
        const added = subtree
          .filter((n) => !known.has(n.id))
          .map((n) => ({ ...n, isDeleted: true }));
        return [...added, ...prev];
      });
      const deleteSubtree = (): Promise<void> =>
        Promise.all(subtree.map((n) => ds.softDeleteNoteUnified(n.id))).then(
          () => {},
        );
      // The undo waits on this one (#1682) — restoring a row whose soft
      // delete has not landed yet would be undone by the delete arriving
      // after it.
      const landed = deleteSubtree();
      void landed.catch((e) => reportNoteWriteError("delete", e, onWriteError));

      if (!opts?.skipUndo) {
        push("note", {
          label: "softDeleteNote",
          undo: async () => {
            setNotes((p) => [...subtree, ...p]);
            setDeletedNotes((p) => p.filter((n) => !subtreeIds.has(n.id)));
            await afterSettled(landed);
            await Promise.all(subtree.map((n) => ds.restoreNoteUnified(n.id)));
          },
          redo: () => {
            setNotes((p) => p.filter((n) => !subtreeIds.has(n.id)));
            setDeletedNotes((p) => {
              const known = new Set(p.map((n) => n.id));
              const added = subtree
                .filter((n) => !known.has(n.id))
                .map((n) => ({ ...n, isDeleted: true }));
              return [...added, ...p];
            });
            return deleteSubtree();
          },
        });
      }
    },
    [
      ds,
      push,
      notesRef,
      selectedNoteIdRef,
      setNotes,
      setDeletedNotes,
      setSelectedNoteId,
      onWriteError,
    ],
  );

  const togglePin = useCallback(
    (id: string) => {
      const note = notesRef.current.find((n) => n.id === id);
      if (!note) return;
      const newPinned = !note.isPinned;
      const prevPinned = note.isPinned;

      setNotes((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, isPinned: newPinned, updatedAt: new Date().toISOString() }
            : n,
        ),
      );

      const landed = ds.updateNoteUnified(id, { isPinned: newPinned });
      void landed.catch((e) => reportNoteWriteError("pin", e, onWriteError));

      push("note", {
        label: "togglePin",
        undo: async () => {
          setNotes((p) =>
            p.map((n) =>
              n.id === id
                ? {
                    ...n,
                    isPinned: prevPinned,
                    updatedAt: new Date().toISOString(),
                  }
                : n,
            ),
          );
          await afterSettled(landed);
          await ds.updateNoteUnified(id, { isPinned: prevPinned });
        },
        redo: () => {
          setNotes((p) =>
            p.map((n) =>
              n.id === id
                ? {
                    ...n,
                    isPinned: newPinned,
                    updatedAt: new Date().toISOString(),
                  }
                : n,
            ),
          );
          return ds
            .updateNoteUnified(id, { isPinned: newPinned })
            .then(() => {});
        },
      });
    },
    [ds, push, notesRef, setNotes, onWriteError],
  );

  return { createNote, updateNote, softDeleteNote, togglePin };
}
