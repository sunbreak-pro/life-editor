import { useSyncExternalStore } from "react";
import {
  getRecentNoteIds,
  subscribeRecentNotes,
} from "../state/recentNotesStore";

/**
 * Recently opened note ids, newest first (#1149).
 *
 * `useSyncExternalStore` rather than a `useState` read at mount, because the
 * list changes underneath a mounted tree: opening a note from the Materials
 * empty state records it, and the empty state is what is on screen at that
 * moment. The store caches its snapshot by identity for exactly this reason
 * (see recentNotesStore) — re-parsing storage per call would loop the render.
 *
 * `getServerSnapshot` is the same function: the store degrades to an empty list
 * when localStorage is unreachable, so there is nothing to differ about.
 */
export function useRecentNoteIds(): readonly string[] {
  return useSyncExternalStore(
    subscribeRecentNotes,
    getRecentNoteIds,
    getRecentNoteIds,
  );
}
