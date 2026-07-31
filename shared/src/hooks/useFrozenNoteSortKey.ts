import { useState } from "react";
import type { NoteNode } from "../types/note";
import type { FrozenNoteSortKey } from "../utils/noteSort";

/*
 * useFrozenNoteSortKey (#366).
 *
 * Holds the selected note's list position while it is being edited.
 *
 * The sidebar sorts newest-first by default, and `updateNote` bumps
 * `updatedAt` optimistically on every debounced content save (~800 ms after a
 * typing pause). Without a hold, the row the user is typing into jumps to the
 * top of its tag group mid-sentence — the note moves out from under the
 * cursor's neighbourhood on a timer the user never asked for.
 *
 * The hold is a SORT KEY snapshot, not a pinned index: `sortNotesForList`
 * compares the held note by the key it had when it was selected, so
 * everything else keeps re-sorting normally around it and the row still
 * renders live data. Selecting another note releases the hold, and the note
 * then lands at its true (newest) position — matching "resort is deferred
 * until deselection" rather than suppressed.
 *
 * Snapshot timing: taken during render, not in an effect, so the very first
 * render after a selection change is already held. An effect would let one
 * unheld render through — the exact frame the jump happens in.
 *
 * Held in STATE, adjusted during render (#505). The snapshot used to live in
 * refs written while rendering, which is the thing a render React throws away
 * must not do. "Adjust state when a prop changes" is React's own escape hatch
 * for exactly this shape: the set is guarded so it happens only on a real
 * change, and React re-runs the component before committing — so the value
 * returned below is still the one this very render sees. The refs version and
 * this one produce the same output for every input; only the mechanism moved.
 */
export function useFrozenNoteSortKey(
  selectedId: string | null | undefined,
  notes: readonly NoteNode[],
): FrozenNoteSortKey | null {
  const [held, setHeld] = useState<{
    id: string | null;
    key: FrozenNoteSortKey | null;
  }>({ id: null, key: null });

  const id = selectedId ?? null;

  // Re-snapshot when the selection changes, and keep retrying while the note
  // is missing from `notes` (a freshly created note reaches the list a tick
  // after it is selected — capturing null there would leave it unheld).
  if (held.id !== id || (id !== null && held.key === null)) {
    const note = id === null ? undefined : notes.find((n) => n.id === id);
    const key = note
      ? {
          id: note.id,
          title: note.title,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        }
      : null;
    // Guarded: while the note is still missing this branch runs every render,
    // and re-setting the identical "not found yet" snapshot would never
    // settle. Only a new selection, or the note finally arriving, is a write.
    if (held.id !== id || key !== null) setHeld({ id, key });
    return key;
  }

  return held.key;
}
