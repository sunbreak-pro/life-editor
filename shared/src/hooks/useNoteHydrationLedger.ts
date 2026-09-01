import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { NoteNode } from "../types/note";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { readNoteBody } from "../state/noteBodyStore";

/**
 * The hydrated-body / own-write ledger behind useNotesUnifiedAPI (#587 split).
 *
 * #301 and #607 are one ref cluster, not two features: the targeted list-merge
 * (keep a cached body while `updatedAt` is unchanged) and the own-write cover
 * (our client stamp never equals the server's, so the OPEN note needs its own
 * keep-rule) read and retire each other's marks inside the same reload. They
 * move together or not at all, which is why this hook owns all three refs and
 * the merge, and the orchestrator only wires its load effect through
 * `mergeLoadedList`.
 */

export interface UseNoteHydrationLedgerParams {
  ds: DataService;
  setNotes: Dispatch<SetStateAction<NoteNode[]>>;
  /** The open note's id — the #607 mark only outranks the server for it. */
  selectedNoteId: string | null;
  selectedNoteIdRef: MutableRefObject<string | null>;
  notesRef: MutableRefObject<NoteNode[]>;
}

export function useNoteHydrationLedger(params: UseNoteHydrationLedgerParams) {
  const { ds, setNotes, selectedNoteId, selectedNoteIdRef, notesRef } = params;

  // M1 (perf): the note LIST is fetched WITHOUT the body (content_json) —
  // list NoteNodes carry `content = ""`. The body is loaded on demand when
  // a note is opened. `contentLoadedIds` tracks which notes have had their
  // real body hydrated into the `notes` array (via getNoteUnified), so a
  // re-select doesn't re-fetch. A list (re)load keeps the entries whose
  // `updatedAt` did not move and drops only the genuinely-touched ones
  // (#301 — see `mergeLoadedList`; it used to clear the whole set).
  const contentLoadedIdsRef = useRef<Set<string>>(new Set());
  /*
   * Ids whose body in `notes` is OURS — written by this client and not yet
   * reconciled with the row the server hands back (#607).
   *
   * `mergeLoadedList` keeps a cached body only while `prev.updatedAt ===
   * row.updatedAt`, which is the right test for someone ELSE's write. It can
   * never hold for our own: we stamp an optimistic CLIENT clock and the reload
   * carries the SERVER's, so the merge would drop precisely the note the user
   * is typing in — and typing is what triggers the reload (the own-write
   * Realtime echo bumps syncVersion ~1.1s later, #300). Dropping it flips
   * `isContentLoaded` to false, and the mobile sheet answers that by swapping
   * its editor for a skeleton: the field loses focus and the phone's keyboard
   * closes mid-sentence.
   *
   * The mark is cleared when the note stops being the open one. While it IS
   * open our buffer is the newest copy anywhere, which is already how Desktop
   * behaves (its editor is keyed by note id and never re-reads); once the user
   * moves on, the next reload is free to notice a foreign write and re-hydrate.
   */
  const locallyWrittenIdsRef = useRef<Set<string>>(new Set());
  /*
   * Writes we have sent but not yet seen come back, per id (#607). The mark
   * above is retired by the reload that used it, which is what keeps a foreign
   * write from being ignored for the rest of the session. That retirement is
   * only safe once the server has acknowledged the write it was covering:
   * while another one is still in flight its echo has not arrived yet, so the
   * mark has to survive this reload too.
   */
  const unackedWritesRef = useRef<Map<string, number>>(new Map());

  /** Remember that OUR write is what moved this row's `updatedAt` (#607). */
  const markLocalWrite = useCallback((id: string) => {
    if (contentLoadedIdsRef.current.has(id)) {
      locallyWrittenIdsRef.current.add(id);
    }
  }, []);

  /** Run a write while counting it as unacknowledged (#607 — see the ref). */
  const trackWrite = useCallback(
    (id: string, write: Promise<unknown>): Promise<unknown> => {
      const map = unackedWritesRef.current;
      map.set(id, (map.get(id) ?? 0) + 1);
      return write.finally(() => {
        const left = (map.get(id) ?? 1) - 1;
        if (left > 0) map.set(id, left);
        else map.delete(id);
      });
    },
    [],
  );

  // #607: the mark only outranks the server for the note that is OPEN. Once
  // the user moves on, drop it so a later reload can notice a foreign write
  // and re-hydrate normally (#301).
  useEffect(() => {
    const stillOpen =
      selectedNoteId !== null &&
      locallyWrittenIdsRef.current.has(selectedNoteId);
    locallyWrittenIdsRef.current = new Set(stillOpen ? [selectedNoteId] : []);
  }, [selectedNoteId]);

  /**
   * Mark a body already present locally (a create, or an edited body written
   * optimistically) as hydrated, so a later reselect/reload doesn't drop back
   * to the light "".
   */
  const markHydrated = useCallback((id: string) => {
    contentLoadedIdsRef.current.add(id);
  }, []);

  // Hydrate a note's real body into the `notes` array. No-op if already
  // hydrated. Returns true when the note's body is present afterwards.
  const hydrateContent = useCallback(
    async (id: string): Promise<boolean> => {
      if (contentLoadedIdsRef.current.has(id)) return true;
      try {
        const full = await ds.getNoteUnified(id);
        if (!full) return false;
        contentLoadedIdsRef.current.add(id);
        setNotes((prev) =>
          prev.map((n) => (n.id === id ? { ...n, content: full.content } : n)),
        );
        return true;
      } catch (e) {
        logServiceError("Notes", "hydrateContent", e);
        return false;
      }
    },
    [ds, setNotes],
  );

  /*
   * Is this note's real body in the `notes` array right now?
   *
   * A surface that MOUNTS an editor per open has to ask, because selection
   * alone does not answer it: `selectedNoteId` survives closing that surface
   * and survives list reloads, while the body it points at can be dropped by a
   * reload (a write from another device moves `updatedAt`, so the merge
   * refuses to keep the cached body and re-hydrates asynchronously). Mounting
   * an editor inside that window would open an EMPTY body over a note that has
   * one — and the first keystroke would save the empty version (#471).
   *
   * The Desktop editor never hits this: it is keyed by note id and simply does
   * not remount, so it keeps showing the body it opened with. The mobile sheet
   * mounts a fresh editor every time it opens.
   *
   * Reading a ref during render is safe here because the completing hydrate
   * calls setNotes right after adding the id, so every transition is followed
   * by a re-render.
   */
  const isContentLoaded = useCallback(
    (id: string): boolean => contentLoadedIdsRef.current.has(id),
    [],
  );

  /**
   * The #301/#607 list merge. Takes the body-free rows a list fetch returned,
   * keeps the cached body for every hydrated id that was not genuinely
   * touched, and updates both ledgers (hydrated set + own-write marks) as a
   * side effect. The caller decides what to do with `merged` (setNotes) and
   * with an open note the merge dropped (`stillHydrated` answers that).
   */
  const mergeLoadedList = useCallback(
    (
      loaded: NoteNode[],
    ): { merged: NoteNode[]; stillHydrated: Set<string> } => {
      // #301 perf: `loaded` rows are body-free (M1) but metadata-fresh.
      // Blanket-clearing the hydrated-body cache here forced a network
      // re-fetch for EVERY previously-viewed note on EVERY syncVersion
      // bump — and typing anywhere bumps syncVersion ~1.1s later (own-
      // write Realtime echo, see #300), so re-selecting an already-open
      // note almost never hit the cache. A row's `updatedAt` only moves
      // when something actually wrote to that note, so keep the cached
      // body for any hydrated id whose `updatedAt` is unchanged, and
      // only drop the ones that were genuinely touched (by this client,
      // another tab, or MCP) since our last hydrate.
      const prevById = new Map(notesRef.current.map((n) => [n.id, n]));
      const stillHydrated = new Set<string>();
      const merged = loaded.map((row) => {
        const prev = prevById.get(row.id);
        if (
          prev &&
          contentLoadedIdsRef.current.has(row.id) &&
          // #607: `updatedAt` moving means "someone wrote to this note",
          // which is only a reason to drop our copy when that someone was
          // not us. Our own stamp is a client clock and can never match
          // the server's, so the OPEN note would otherwise be the one row
          // guaranteed to fail this test on every keystroke's echo. Scoped
          // to the open note on purpose: for any other note a drop just
          // costs a lazy re-fetch, while pinning it would hide a foreign
          // write behind a body nobody is looking at.
          (prev.updatedAt === row.updatedAt ||
            (row.id === selectedNoteIdRef.current &&
              locallyWrittenIdsRef.current.has(row.id)))
        ) {
          stillHydrated.add(row.id);
          return { ...row, content: prev.content };
        }
        /*
         * #1407: the same keep-rule, one mount earlier. A FIRST merge after a
         * remount has no `prev` for anything — the section providers are
         * unmounted on every switch away from Materials, so both `notesRef`
         * and the hydrated set above start empty — and the bodies it is
         * missing are exactly the ones the user was just reading. The
         * cross-mount cache answers for them, under the same `updatedAt`
         * equality the in-memory branch uses, so a note somebody wrote to
         * while we were away still falls through to a re-hydrate.
         *
         * Only when there is no `prev`: live state always outranks the cache,
         * including the #607 own-write cover above, which the cache has no
         * equivalent of (our optimistic client stamp never matches a cached
         * server one, so a hit is impossible for the note being typed in
         * anyway).
         */
        if (prev === undefined) {
          const cached = readNoteBody(ds, row.id, row.updatedAt);
          if (cached !== null) {
            stillHydrated.add(row.id);
            return { ...row, content: cached };
          }
        }
        return row;
      });
      contentLoadedIdsRef.current = stillHydrated;
      // A kept row above adopted the SERVER's `updatedAt`, so plain
      // equality answers for it from here on and the mark has done its
      // job. Retiring it is what lets the NEXT foreign write drop the body
      // and re-hydrate (#301) instead of our copy outranking the server
      // for the rest of the session. A write still in flight keeps its
      // mark: its echo has not arrived yet, so it still needs the cover.
      const seenIds = new Set(loaded.map((row) => row.id));
      locallyWrittenIdsRef.current = new Set(
        [...locallyWrittenIdsRef.current].filter(
          (id) =>
            !seenIds.has(id) || (unackedWritesRef.current.get(id) ?? 0) > 0,
        ),
      );
      return { merged, stillHydrated };
    },
    [ds, notesRef, selectedNoteIdRef],
  );

  return {
    markLocalWrite,
    trackWrite,
    markHydrated,
    hydrateContent,
    isContentLoaded,
    mergeLoadedList,
    /*
     * The raw hydrated-ids ref, for EFFECT guards only. An effect that wants
     * the synchronous already-hydrated fast path (#282 restore) must read the
     * set through the ref: guarding a sync setState behind the
     * `isContentLoaded()` call trips react-hooks/set-state-in-effect, while
     * the ref-read guard is the shape the rule accepts — and the pre-split
     * code used. Everywhere else, use `isContentLoaded`.
     */
    hydratedIdsRef: contentLoadedIdsRef,
  };
}
