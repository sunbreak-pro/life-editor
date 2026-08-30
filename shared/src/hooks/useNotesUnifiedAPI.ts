import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { NoteNode, NoteSortMode } from "../types/note";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { createNoopUndoRedo, type UndoRedoLike } from "./useTodoTreeHistory";
import { useSyncDomains } from "./useSyncDomains";
import { useDomainLoad } from "./useDomainLoad";
import { useNoteHydrationLedger } from "./useNoteHydrationLedger";
import { useNotesUnifiedCRUD } from "./useNotesUnifiedCRUD";
import { useNotesUnifiedTrash } from "./useNotesUnifiedTrash";
import { useNotesUnifiedLock } from "./useNotesUnifiedLock";
import {
  type NoteSortDirection,
  loadExpandedIds,
  saveExpandedIds,
  loadSortDirection,
  saveSortDirection,
  loadSortMode,
  saveSortMode,
  buildChildrenByParent,
  flattenVisibleNotes,
  filterAndSortNotes,
} from "./notesUnifiedHelpers";
import {
  getNotesSelection,
  setNotesSelection,
  clearNotesSelection,
} from "../state/materialsSelectionStore";
import { recordNoteOpened } from "../state/recentNotesStore";

/**
 * DU-G G4: behaviour-preserving port of the former legacy Notes hook, with the
 * DataService call sites rewritten to the Unified (items_meta +
 * notes_payload) method names. The legacy Notes Bridge class
 * that used to map legacy → Unified names has been retired; this hook now
 * calls `*Unified` DataService methods directly.
 *
 * Host dependencies are injected, not imported (CLAUDE.md §6.4):
 * - `getDataService()` singleton  → `options.dataService`
 * - host UndoRedo Context         → `options.undoRedo` (no-op default;
 *   real UndoRedo lands in S6, same as todos/daily)
 *
 * #587 split — this file is the orchestrator (state, selection, the load /
 * restore effects, and composition), shaped after useTodoTreeAPI. The
 * responsibilities live next door:
 * - notesUnifiedHelpers.ts    pure helpers (localStorage, node factory,
 *                             tree derivations, subtree collect)
 * - useNoteHydrationLedger.ts the #301/#607 hydrated-body + own-write ledger
 * - useNotesUnifiedCRUD.ts    create / update / soft-delete / pin
 * - useNotesUnifiedTrash.ts   Trash load / restore / purge
 * - useNotesUnifiedLock.ts    password gate + edit lock
 *
 * Must sit inside a Sync Provider (reads `useSyncContext`) — CLAUDE.md
 * §6.2 places Note after Sync (and, by convention, after Daily).
 */

export type { NoteSortDirection };

export interface UseNotesUnifiedAPIOptions {
  dataService: DataService;
  undoRedo?: UndoRedoLike;
}

export function useNotesUnifiedAPI(options: UseNotesUnifiedAPIOptions) {
  const ds = options.dataService;
  const { push } = options.undoRedo ?? createNoopUndoRedo();
  const syncVersion = useSyncDomains("notes");

  const [notes, setNotes] = useState<NoteNode[]>([]);
  const [deletedNotes, setDeletedNotes] = useState<NoteNode[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortModeState] = useState<NoteSortMode>(loadSortMode);
  const [sortDirection, setSortDirectionState] =
    useState<NoteSortDirection>(loadSortDirection);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(loadExpandedIds);
  const notesRef = useRef(notes);
  const selectedNoteIdRef = useRef(selectedNoteId);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  useEffect(() => {
    selectedNoteIdRef.current = selectedNoteId;
  }, [selectedNoteId]);

  // The hydrated-body / own-write ledger (#301 + #607) — owns which bodies
  // are real in `notes` and which `updatedAt` moves were ours.
  const {
    markLocalWrite,
    trackWrite,
    markHydrated,
    hydrateContent,
    isContentLoaded,
    mergeLoadedList,
    hydratedIdsRef,
  } = useNoteHydrationLedger({
    ds,
    setNotes,
    selectedNoteId,
    selectedNoteIdRef,
    notesRef,
  });

  // "Latest select wins": if two selects race (fast clicks), only the most
  // recent one is allowed to commit its `setSelectedNoteId`, so a slow
  // earlier fetch can't clobber a newer selection.
  const selectTokenRef = useRef(0);

  // Select a note, loading its body FIRST (M1). The web editor initialises
  // its content once at mount from `selectedNote.content` and never
  // re-syncs while its note id is unchanged (useEditor dep `[noteId]`), so
  // the body MUST be present in the `notes` array before selection flips —
  // otherwise the editor would open empty and a subsequent edit would
  // overwrite the real body. On a hydrate failure the selection is left
  // unchanged (safer than opening an empty editor over a note that has
  // content). #375: the body-free folder shortcut is gone with the folder
  // type — every selectable node is a note with a body now.
  const selectNote = useCallback(
    (id: string | null): void => {
      const token = ++selectTokenRef.current;
      if (id === null) {
        setSelectedNoteId(null);
        clearNotesSelection(); // #282: persist deselection across remounts
        return;
      }
      if (isContentLoaded(id)) {
        setSelectedNoteId(id);
        setNotesSelection(id); // #282
        recordNoteOpened(id); // #1149: feeds the empty state's candidates
        return;
      }
      void (async () => {
        const ok = await hydrateContent(id);
        if (selectTokenRef.current !== token) return; // superseded
        if (ok) {
          setSelectedNoteId(id);
          setNotesSelection(id); // #282
          recordNoteOpened(id); // #1149: feeds the empty state's candidates
        }
      })();
    },
    [hydrateContent, isContentLoaded],
  );

  /*
   * One-shot RESTORE (#282): re-open the note the user had selected before the
   * provider unmounted (Materials tab/section switch). The id lives in the
   * module-level materialsSelectionStore, which outlives this React tree.
   *
   * CALLED FROM THE LOAD'S `apply`, WITH THE LIST IT JUST APPLIED (#1285) —
   * not from an effect reading `notes`. The effect version broke the moment
   * #1101 gave this domain a snapshot: a mount that finds one is already
   * `settled`, so `isLoading` is false on the FIRST render and the restore
   * effect ran that render's closure, where `notes` is still `[]`. It then read
   * its own "the stored id is not in the list" branch as "the note is gone",
   * cleared the store and burned the one-shot — which is exactly the reported
   * bug: leave Materials, come back, and the note you had open is not merely
   * unselected, it is forgotten. The first visit of a session looked fine
   * because there is no snapshot yet.
   *
   * Taking the list as an ARGUMENT removes the class of bug rather than the
   * instance, and matches what `useTodoTreeAPI` has always done next door.
   * `apply` only runs on a SUCCESSFUL read, so a failed fetch still cannot
   * consume the one-shot or erase the remembered id.
   *
   * NOT FROM THE SNAPSHOT REPLAY, only from the fetch (`fetchLandedRef` below).
   * The replay runs in useDomainLoad's LAYOUT effect, so restoring there starts
   * the body hydrate while the revalidating read is still in flight — and that
   * read's own `mergeLoadedList` reads `notesRef`, which React updates in a
   * passive effect and can therefore still be one flush behind the hydrate.
   * The body it just fetched would be merged away. Waiting for the read costs
   * one round trip and is exactly the timing this restore had before #1101
   * introduced snapshots — the list still paints instantly from the snapshot,
   * which is what that feature was for.
   *
   * Restore MUST take the same hydrate-first path as selectNote — the web editor
   * initialises its content once per noteId and never re-syncs, so flipping
   * selectedNoteId onto an un-hydrated id would open a blank editor over a note
   * that has a body (DATA LOSS). A stored id absent from the loaded list, or a
   * hydrate failure, clears the store entry (no retry loops).
   */
  const restoredRef = useRef(false);
  /** Flipped by the read below, so `apply` can tell a fetch from a replay. */
  const fetchLandedRef = useRef(false);
  const restoreSelection = useCallback(
    (loaded: NoteNode[]) => {
      if (restoredRef.current) return;
      restoredRef.current = true;
      const storedId = getNotesSelection();
      if (storedId === null) return;
      if (selectedNoteIdRef.current !== null) return; // user already selected
      const node = loaded.find((n) => n.id === storedId);
      if (!node) {
        clearNotesSelection(); // stale id — item gone since last session tab
        return;
      }
      const token = ++selectTokenRef.current;
      // Ref-read guard on purpose — see hydratedIdsRef's contract on the ledger.
      if (hydratedIdsRef.current.has(storedId)) {
        setSelectedNoteId(storedId);
        return;
      }
      void (async () => {
        const ok = await hydrateContent(storedId);
        if (selectTokenRef.current !== token) return; // superseded by user select
        if (ok) {
          setSelectedNoteId(storedId);
        } else {
          clearNotesSelection(); // hydrate failed — drop the id, don't retry
        }
      })();
    },
    [hydrateContent, hydratedIdsRef],
  );

  const setSortDirection = useCallback((dir: NoteSortDirection) => {
    setSortDirectionState(dir);
    saveSortDirection(dir);
  }, []);

  const setSortMode = useCallback((mode: NoteSortMode) => {
    setSortModeState(mode);
    saveSortMode(mode);
  }, []);

  // Load the tree on mount and on every notes bump, through the shared load
  // effect (#672 / #891). Same three states as the hand-written version it
  // replaces, plus #296's error un-latch, which this hook was missing: one
  // transient failure used to leave the error card up for the rest of the
  // session. `hydrateContent` and `mergeLoadedList` are no longer deps — the
  // shared hook reads the callbacks through a ref, and both were stable
  // against everything but `ds`, which is a dep here in its own right.
  const { isLoading, error } = useDomainLoad({
    domain: "Notes",
    snapshotKey: "notes",
    dataService: ds,
    version: syncVersion,
    load: async (service) => {
      const rows = await service.listNotesUnified();
      // Set HERE, not in `apply`: this is the only point that is reachable
      // solely by the read. The snapshot replay never runs it.
      fetchLandedRef.current = true;
      return rows;
    },
    apply: (loaded) => {
      // #301/#607: the merge and both ledger updates live in
      // useNoteHydrationLedger.mergeLoadedList — see the rationale there.
      const { merged, stillHydrated } = mergeLoadedList(loaded);
      setNotes(merged);
      // #282 / #1285: the restore reads THIS list, not a render closure — and
      // only once the read itself has landed (see restoreSelection's header).
      if (fetchLandedRef.current) restoreSelection(merged);
      // Keep the currently-open note's body correct after a sync-triggered
      // reload (the editor is keyed by note id so it won't remount; this just
      // refills `notes[id].content` so a later read of `selectedNote.content`
      // is accurate). Skipped when the merge above already proved nothing
      // wrote to it.
      const openId = selectedNoteIdRef.current;
      if (openId && !stillHydrated.has(openId)) void hydrateContent(openId);
    },
    fallbackMessage: "Failed to load notes",
    // The old effect only ever wrote `isLoading` false, never back to true, so
    // a bump-driven re-read left the tree on screen. Realtime echoes the tab's
    // own writes back (syncDomains.ts), so reporting a re-read as loading here
    // would blank the note list on every keystroke-driven save.
    refetchReportsLoading: false,
  });

  // Trash list is loaded alongside the active tree (same trigger: initial
  // mount + every syncVersion bump) so the Trash section is populated without
  // the host having to call loadDeletedNotes(). Kept OUT of the load above on
  // purpose: it has its own try/catch so a Trash failure never blocks the tree
  // or raises the tree's error card.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const deleted = await ds.fetchDeletedNotesUnified();
        if (!cancelled) setDeletedNotes(deleted);
      } catch (e) {
        logServiceError("Notes", "fetchDeleted", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ds, syncVersion]);

  // Tree derivations — pure functions of their inputs (notesUnifiedHelpers),
  // memoized here.
  const childrenByParent = useMemo(() => buildChildrenByParent(notes), [notes]);

  const getChildren = useCallback(
    (parentId: string | null): NoteNode[] => {
      return childrenByParent.get(parentId) ?? [];
    },
    [childrenByParent],
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      saveExpandedIds(next);
      return next;
    });
  }, []);

  const flattenedNotes = useMemo(
    () => flattenVisibleNotes(notes, expandedIds),
    [notes, expandedIds],
  );

  const sortedFilteredNotes = useMemo(
    () => filterAndSortNotes(notes, searchQuery, sortMode, sortDirection),
    [notes, searchQuery, sortMode, sortDirection],
  );

  // Persist tree to DB. Unified has no bulk sync — apply moves
  // sequentially (verbatim port of the retired Bridge `syncNoteTree`).
  const syncToDb = useCallback(
    (updatedNotes: NoteNode[]) => {
      const items = updatedNotes.map((n) => ({
        id: n.id,
        parentId: n.parentId,
        order: n.order,
      }));
      (async () => {
        for (const i of items) {
          await ds.moveNoteUnified(i.id, i.parentId, i.order);
        }
      })().catch((e) => logServiceError("Notes", "syncTree", e));
    },
    [ds],
  );

  const persistWithHistory = useCallback(
    (currentNotes: NoteNode[], updated: NoteNode[]) => {
      setNotes(updated);
      syncToDb(updated);
      push("note", {
        label: "moveNote",
        undo: () => {
          setNotes(currentNotes);
          syncToDb(currentNotes);
        },
        redo: () => {
          setNotes(updated);
          syncToDb(updated);
        },
      });
    },
    [push, syncToDb],
  );

  const { createNote, updateNote, softDeleteNote, togglePin } =
    useNotesUnifiedCRUD({
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
    });

  const { loadDeletedNotes, restoreNote, permanentDeleteNote } =
    useNotesUnifiedTrash({
      ds,
      deletedNotes,
      setDeletedNotes,
      setNotes,
    });

  const {
    setNotePassword,
    removeNotePassword,
    verifyNotePassword,
    toggleEditLock,
  } = useNotesUnifiedLock({ ds, setNotes });

  const selectedNote = useMemo(() => {
    return notes.find((n) => n.id === selectedNoteId) ?? null;
  }, [notes, selectedNoteId]);

  return useMemo(
    () => ({
      notes,
      isLoading,
      error,
      deletedNotes,
      selectedNoteId,
      // M1: expose the hydrate-then-select wrapper under the same name so
      // consumers (e.g. web NotesView `onSelect`) load the body before the
      // editor mounts — the light list carries no body.
      setSelectedNoteId: selectNote,
      selectedNote,
      isContentLoaded,
      searchQuery,
      setSearchQuery,
      sortMode,
      setSortMode,
      sortDirection,
      setSortDirection,
      sortedFilteredNotes,
      flattenedNotes,
      expandedIds,
      toggleExpanded,
      getChildren,
      createNote,
      updateNote,
      softDeleteNote,
      togglePin,
      loadDeletedNotes,
      restoreNote,
      permanentDeleteNote,
      persistWithHistory,
      setNotePassword,
      removeNotePassword,
      verifyNotePassword,
      toggleEditLock,
    }),
    [
      notes,
      isLoading,
      error,
      deletedNotes,
      selectedNoteId,
      selectNote,
      selectedNote,
      isContentLoaded,
      searchQuery,
      sortMode,
      setSortMode,
      sortDirection,
      setSortDirection,
      sortedFilteredNotes,
      flattenedNotes,
      expandedIds,
      toggleExpanded,
      getChildren,
      createNote,
      updateNote,
      softDeleteNote,
      togglePin,
      loadDeletedNotes,
      restoreNote,
      permanentDeleteNote,
      persistWithHistory,
      setNotePassword,
      removeNotePassword,
      verifyNotePassword,
      toggleEditLock,
    ],
  );
}
