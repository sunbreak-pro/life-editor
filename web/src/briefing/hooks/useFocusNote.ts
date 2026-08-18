import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSaveFailureReport } from "./useSaveFailureReport";
import {
  FOCUS_NOTE_ID,
  addDaysKey,
  extractFocus,
  mergeFocusSection,
  normalizeFocusText,
  useSyncDomains,
  useTranslation,
  type DataService,
} from "@life-editor/shared";

/** Debounce for the focus field → section-merge save (flushed on blur). */
const FOCUS_SAVE_DEBOUNCE_MS = 800;

/*
 * The focus note (#1048) — read, draft and save of the focus line.
 *
 * Storage is ONE reserved note (`note-focus`) whose body carries one section
 * per day, keyed by date (shared/src/components/briefing/focusSections.ts).
 * TWO days matter to a single render of the Briefing section:
 *
 * - TODAY's section is what the morning paper prints as its focus line
 *   (read-only here — it was written last evening).
 * - TOMORROW's section is what the evening paper's focus field edits
 *   (draft + debounced section-merge save, like the goals fields).
 *
 * The mechanics are the goals hook's (useGoalsDoc), single-field: fetch by id
 * (`listNotesUnified` carries no bodies), create the note on the FIRST SAVE
 * only, serialize the read and every write on one chain, and compare stored
 * text semantically (the extracted value, not the jsonb round-tripped bytes)
 * so the save's own echo keeps the draft while a genuinely external change
 * drops it.
 */

export function useFocusNote(ds: DataService, todayKey: string) {
  const { t } = useTranslation();
  const reportSaveFailure = useSaveFailureReport();
  // The evening field writes TOMORROW's key: setting the focus is part of
  // closing today, and the next morning's paper reads its own day's section.
  const tomorrowKey = useMemo(() => addDaysKey(todayKey, 1), [todayKey]);
  // The focus lives in a note, so a Realtime note change (Notes-side edit,
  // another device) must bring the paper along (rules/frontend.md §Sync).
  const syncVersion = useSyncDomains("notes");

  const [content, setContent] = useState<string | null>(null);
  // Same gate as the goals note: the evening field must not render empty over
  // a focus that DOES exist — a keystroke typed into that window would
  // overwrite the stored text once the debounce fires.
  const [focusLoading, setFocusLoading] = useState(true);

  // ONE chain for the read AND the writes (useGoalsDoc's reasoning): a refetch
  // resolving after a later save would roll the shown text back.
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    saveChainRef.current = saveChainRef.current.then(async () => {
      try {
        const note = await ds.getNoteUnified(FOCUS_NOTE_ID);
        if (!cancelled) setContent(note?.content ?? null);
      } catch (err) {
        // A failed read keeps the previous text but must open the gate, or a
        // hiccup strands the paper on the skeleton. No toast on a read —
        // nothing the user typed is at stake (#955's reasoning).
        console.error("[BriefingScreen] focus note fetch failed", err);
      } finally {
        if (!cancelled) setFocusLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ds, syncVersion]);

  /** Today's focus — the morning paper's line, written last evening. */
  const todayFocus = useMemo(
    () => extractFocus(content, todayKey),
    [content, todayKey],
  );
  const storedTomorrow = useMemo(
    () => extractFocus(content, tomorrowKey),
    [content, tomorrowKey],
  );

  // Draft model (controlled field — no remount): draft ?? stored is what the
  // field shows. `synced` pairs the last reconciled stored text with the queue
  // of our own not-yet-landed save values; a stored change matching a queued
  // echo is our own save landing and KEEPS the draft, anything else is an
  // external change and drops it. Render-phase adjustment on pure state
  // (idempotent under StrictMode's double render) — useGoalsDoc's model.
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const [synced, setSynced] = useState<{
    text: string | null;
    echoes: (string | null)[];
  }>({ text: storedTomorrow, echoes: [] });

  if (synced.text !== storedTomorrow) {
    const idx = synced.echoes.indexOf(storedTomorrow);
    // A matching echo retires itself and any stale ones queued before it.
    if (idx < 0 && draft !== undefined) setDraft(undefined);
    setSynced({
      text: storedTomorrow,
      echoes: idx < 0 ? synced.echoes : synced.echoes.slice(idx + 1),
    });
  }

  const noteTitle = t("briefing.focusNoteTitle");

  const persistFocus = useCallback(
    (text: string) => {
      const normalized = normalizeFocusText(text);
      setSynced((s) => ({ ...s, echoes: [...s.echoes, normalized] }));
      const retireEcho = () =>
        setSynced((s) => {
          const i = s.echoes.indexOf(normalized);
          if (i < 0) return s;
          return { ...s, echoes: s.echoes.filter((_, idx) => idx !== i) };
        });
      saveChainRef.current = saveChainRef.current.then(async () => {
        try {
          const fresh = await ds.getNoteUnified(FOCUS_NOTE_ID);
          const freshContent = fresh?.content ?? "";
          const merged = mergeFocusSection(freshContent, tomorrowKey, text);
          if (merged === freshContent) {
            // No-op write (and, on a missing note, no note) — retire the echo.
            retireEcho();
            return;
          }
          if (fresh === null) {
            const now = new Date().toISOString();
            const created = await ds.createNoteUnified({
              id: FOCUS_NOTE_ID,
              type: "note",
              title: noteTitle,
              content: merged,
              parentId: null,
              order: 0,
              isPinned: false,
              isDeleted: false,
              createdAt: now,
              updatedAt: now,
            });
            setContent(created.content ?? merged);
            return;
          }
          // A trashed note is invisible from Notes but still what the paper
          // reads and writes — writing a focus restores it, the same repair
          // path the goals note has.
          if (fresh.isDeleted === true) {
            await ds.restoreNoteUnified(FOCUS_NOTE_ID);
          }
          const updated = await ds.updateNoteUnified(FOCUS_NOTE_ID, {
            content: merged,
          });
          setContent(updated.content ?? merged);
        } catch (err) {
          reportSaveFailure("focus", err);
        }
      });
    },
    [ds, noteTitle, tomorrowKey, reportSaveFailure],
  );

  const timerRef = useRef<number | undefined>(undefined);
  const pendingRef = useRef<string | undefined>(undefined);

  const flushFocus = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    const pending = pendingRef.current;
    if (pending === undefined) return;
    pendingRef.current = undefined;
    persistFocus(pending);
  }, [persistFocus]);

  // Unmount (or a persist identity change) must not drop tail keystrokes.
  useEffect(() => flushFocus, [flushFocus]);

  const handleFocusChange = useCallback(
    (text: string) => {
      setDraft(text);
      pendingRef.current = text;
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flushFocus, FOCUS_SAVE_DEBOUNCE_MS);
    },
    [flushFocus],
  );

  /** The evening field's value: the live draft, else tomorrow's stored text. */
  const focusDraft = draft ?? storedTomorrow ?? "";

  return {
    todayFocus,
    focusDraft,
    focusLoading,
    handleFocusChange,
    flushFocus,
  };
}
