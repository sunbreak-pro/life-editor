import { useCallback, useRef } from "react";
import {
  collectBodyTables,
  logServiceError,
  useToastOptional,
  useTranslation,
  type DataService,
} from "@life-editor/shared";
import { TagPicker } from "../../wikitag/TagPicker";
import type { TableTagsWiring } from "../TableControls";

/*
 * Note tables as tag-able items (#2094, plan Step 4) — the Notes host's half.
 *
 * Two jobs, both keyed by the note:
 *
 *   - `wiringFor(noteId)` hands the table bar its tag row. A table without a
 *     `tableId` gets a button that makes it an item of this note
 *     (`createNoteTable`); the bar then writes the id into the table node and
 *     the row turns into the ordinary TagPicker for that id.
 *   - `syncSavedBody(noteId, content)` runs after each stored save, beside the
 *     inline-link sync: the service compares the body with the note's table
 *     items and soft-deletes, restores and renames them to match. A failure
 *     only leaves the items one save behind; the next save retries.
 *
 * One note's syncs run in save order, one at a time (the queue below).
 *
 * The sync costs one read per call, so it is skipped for a save that has no
 * table item in it when the previous save of the same note had none either.
 * The FIRST save of a note in this session always runs, which is what tidies
 * an item whose table was removed somewhere this session never saw.
 *
 * Daily bodies are left alone on purpose (plan Q1): only a note can be a
 * table's parent, so the Daily host does not mount this.
 */
export function useNoteTableItems(dataService?: DataService) {
  const { t } = useTranslation();
  const toast = useToastOptional();
  // noteId → whether its last synced body held a table item.
  const hadTables = useRef(new Map<string, boolean>());

  // noteId → the tail of its sync queue. One note's syncs run one at a time,
  // in save order: two in flight could land out of order, and an older body
  // landing last would soft-delete a table item made a moment ago.
  const queues = useRef(new Map<string, Promise<void>>());

  const syncSavedBody = useCallback(
    (noteId: string, content: string) => {
      if (!dataService) return;
      const hasTables = (collectBodyTables(content)?.length ?? 0) > 0;
      const before = hadTables.current.get(noteId);
      hadTables.current.set(noteId, hasTables);
      if (before === false && !hasTables) return;
      const tail = queues.current.get(noteId) ?? Promise.resolve();
      const next = tail.then(() =>
        dataService
          .syncNoteTables(noteId, content)
          .then(() => undefined)
          .catch((e) => logServiceError("Notes", "syncNoteTables", e)),
      );
      queues.current.set(noteId, next);
    },
    [dataService],
  );

  const wiringFor = useCallback(
    (noteId: string): TableTagsWiring | undefined => {
      if (!dataService) return undefined;
      return {
        makeItem: async (name) => {
          try {
            const table = await dataService.createNoteTable({
              parentNoteId: noteId,
              title: name,
            });
            // The body is about to point at an item: the next save syncs.
            hadTables.current.set(noteId, true);
            return table.id;
          } catch (e) {
            logServiceError("Notes", "createNoteTable", e);
            toast?.showToast(
              "danger",
              t("materials.notes.tableControls.tagFailed"),
            );
            return null;
          }
        },
        renderTags: (tableId) => <TagPicker itemId={tableId} size="sm" />,
        labels: {
          group: t("materials.notes.tableControls.tagsGroup"),
          addTags: t("materials.notes.tableControls.addTags"),
          adding: t("materials.notes.tableControls.addingTags"),
        },
      };
    },
    [dataService, t, toast],
  );

  return { syncSavedBody, wiringFor };
}

/** The table-item wiring the Notes host shares with its body editors. */
export type NoteTableItems = ReturnType<typeof useNoteTableItems>;
