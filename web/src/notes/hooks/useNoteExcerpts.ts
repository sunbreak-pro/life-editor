import { useEffect, useMemo, useRef, useState } from "react";
import {
  logServiceError,
  useSyncDomains,
  type DataService,
  type NoteNode,
} from "@life-editor/shared";

/*
 * The one-line excerpts under the note list's titles (#2576).
 *
 * The list's NoteNodes carry no body (`content = ""` until a note is opened),
 * so the excerpt is its own read — the same `listNoteExcerptsUnified` the
 * Connect hub uses (#2224). A failed read leaves the rows without a second
 * line rather than the list without rows.
 *
 * Re-read on a sync push (`notes`) AND when the newest `updatedAt` in the list
 * moves: a body saved on this device does not come back as a push, and
 * without the second key the row would keep the excerpt of the body before
 * the edit. Debounced, because an autosave moves that key every few seconds
 * while the user types and one read covers every note.
 */
const REFETCH_DELAY_MS = 1500;

export function useNoteExcerpts(
  dataService: DataService | undefined,
  notes: readonly NoteNode[],
): ReadonlyMap<string, string> {
  const [excerpts, setExcerpts] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const notesVersion = useSyncDomains("notes");
  const newestUpdate = useMemo(
    () =>
      notes.reduce(
        (latest, n) => (n.updatedAt > latest ? n.updatedAt : latest),
        "",
      ),
    [notes],
  );
  // Only picks the delay, so a ref: as a dep its flip would read twice.
  const loadedOnce = useRef(false);

  useEffect(() => {
    // Test stubs and a DataService-less host have no reader; the rows simply
    // go without a second line.
    if (typeof dataService?.listNoteExcerptsUnified !== "function") return;
    let cancelled = false;
    const run = () => {
      dataService
        .listNoteExcerptsUnified()
        .then((rows) => {
          if (cancelled) return;
          setExcerpts(new Map(rows.map((r) => [r.id, r.excerpt])));
          loadedOnce.current = true;
        })
        .catch((e: unknown) => {
          logServiceError("Notes", "listNoteExcerptsUnified", e);
        });
    };
    // The first read is not delayed: the list is already on screen.
    const timer = setTimeout(run, loadedOnce.current ? REFETCH_DELAY_MS : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dataService, notesVersion, newestUpdate]);

  return excerpts;
}
