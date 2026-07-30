import { useState } from "react";

/*
 * Which note the mobile detail sheet is showing (#471) — the narrow twin of the
 * Desktop selection, extracted so the transitions can be tested without the
 * Notes host (four Providers, TipTap and a DataService).
 *
 * It deliberately does NOT key on the shared `selectedNote`: the sheet has its
 * own identity because opening it also has to HYDRATE the note (the side list
 * omits bodies), and because a selection restored from storage on mount would
 * otherwise pop the sheet open over the list. `useTaskDetailTarget` (#470) keeps
 * the same separation for the Todo sheet, for the same reason.
 *
 * The transitions worth remembering:
 *   - the note vanishes (deleted from the sheet's own kebab, or from another
 *     device mid-session) → drop the id, which closes the sheet. Keeping it
 *     would re-open the sheet the moment the note came back — a restore from
 *     Trash should not resurrect a sheet the user closed minutes ago.
 *   - crossing to wide → close. The Desktop main editor takes over the same
 *     note (it stays selected), so leaving the id set would re-open the sheet
 *     on the way back to narrow.
 *   - a "[[" link tapped INSIDE the sheet moves the selection; the sheet has to
 *     follow it or it would keep the old note's chrome over a body that never
 *     resolves (#475). Only while open — Desktop must not open a sheet.
 */

export interface UseNoteSheetTargetParams<T> {
  /** Current breakpoint (true ≥ 768px). */
  isWide: boolean;
  /** Active notes (deleted excluded) — the pool the open id resolves against. */
  notes: readonly T[];
  /** Select a note in the shared context, which hydrates its body. */
  onSelect: (id: string) => void;
}

export interface NoteSheetTarget<T> {
  /** The note the sheet should render, or null when it should be closed. */
  sheetNote: T | null;
  openSheet: (id: string) => void;
  closeSheet: () => void;
  /** The pending-link handoff moved the selection — follow it if open. */
  followPending: (id: string) => void;
}

export function useNoteSheetTarget<T extends { id: string }>({
  isWide,
  notes,
  onSelect,
}: UseNoteSheetTargetParams<T>): NoteSheetTarget<T> {
  const [sheetNoteId, setSheetNoteId] = useState<string | null>(null);
  const [prevIsWide, setPrevIsWide] = useState(isWide);

  // Adjusting state during render (not in an effect) so the sheet never paints
  // a frame in the stale state — and because react-hooks/set-state-in-effect
  // treats the effect form as an error in this repo.
  if (isWide !== prevIsWide) {
    setPrevIsWide(isWide);
    if (isWide && sheetNoteId !== null) setSheetNoteId(null);
  }

  const found =
    sheetNoteId !== null
      ? (notes.find((note) => note.id === sheetNoteId) ?? null)
      : null;
  if (sheetNoteId !== null && found === null) setSheetNoteId(null);

  return {
    sheetNote: found,
    openSheet: (id: string) => {
      onSelect(id);
      setSheetNoteId(id);
    },
    closeSheet: () => setSheetNoteId(null),
    followPending: (id: string) =>
      setSheetNoteId((current) => (current === null ? current : id)),
  };
}
