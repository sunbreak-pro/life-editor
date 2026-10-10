import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { applyEveningNote, type DataService } from "@life-editor/shared";
import { useSaveFailureReport } from "./useSaveFailureReport";

/*
 * The evening rows' one-line notes (#2107) — `dailies_payload.evening_notes`,
 * a map from the row's key (`todo:<id>` / `session:<id>` / `event:<id>`) to
 * its line.
 *
 * Each save is a read-modify-write of ONE key on the freshest stored map, so
 * a note added from another device is kept rather than overwritten by this
 * screen's copy. It runs on useDailySections' chain (`queueDailyWrite`): the
 * body and mood writes touch the same row and may be the ones creating it.
 *
 * The line is painted before the write lands — it is what the user just
 * typed — and the stored value of THIS key replaces it once the write answers.
 * Only this key: the answer to an earlier write must not wipe a later line
 * still in flight on another row. A failure paints the line again (a Realtime
 * refetch may have dropped it meanwhile) and says so (#955), so the toast's
 * 「書いた内容は画面に残っています」stays true.
 */
export function useEveningNotes(
  ds: DataService,
  todayKey: string,
  setNotes: Dispatch<SetStateAction<Record<string, string> | null>>,
  queueDailyWrite: (job: () => Promise<void>) => void,
): { saveNote: (key: string, text: string) => void } {
  const reportSaveFailure = useSaveFailureReport();

  const saveNote = useCallback(
    (key: string, text: string) => {
      setNotes((prev) => applyEveningNote(prev, key, text));
      queueDailyWrite(async () => {
        try {
          const fresh = await ds.getDailyByDateUnified(todayKey);
          const stored = fresh?.eveningNotes ?? null;
          const next = applyEveningNote(stored, key, text);
          if (next === stored) return;
          // A day with no row yet gets one carrying the note. create rather
          // than upsert-then-update: an upsert of an empty body onto a row
          // another device made in the meantime would blank its text, while a
          // create in that race fails and is reported.
          const updated =
            fresh === null
              ? await ds.createDailyUnified({
                  id: `daily-${todayKey}`,
                  date: todayKey,
                  content: "",
                  eveningNotes: next,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                })
              : await ds.updateDailyUnified(fresh.id, { eveningNotes: next });
          setNotes((prev) =>
            applyEveningNote(prev, key, updated.eveningNotes?.[key] ?? ""),
          );
        } catch (err) {
          setNotes((prev) => applyEveningNote(prev, key, text));
          reportSaveFailure("notes", err);
        }
      });
    },
    [ds, todayKey, setNotes, queueDailyWrite, reportSaveFailure],
  );

  return { saveNote };
}
