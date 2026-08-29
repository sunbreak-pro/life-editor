import { useCallback, useState } from "react";
import type { DataService, TemplateApplyItem } from "@life-editor/shared";

/*
 * Pouring a saved template into the open note (#1181).
 *
 * WHY THIS TALKS TO THE DataService DIRECTLY, unlike everything else in
 * NotesView: a template IS a notes row (items_meta role='note' +
 * notes_payload.note_type='template'), but it must never enter the note list,
 * the search results, the badge count or Trash — so the reads that feed those
 * filter it out, and NotesUnifiedContext consequently never holds one.
 *
 * The list is fetched when the picker OPENS rather than on mount: a note can be
 * read and written for an entire session without anyone asking for a template,
 * and this is the gesture that says otherwise.
 *
 * Only titles come back from the list, so `pick` fetches the chosen template's
 * body before the confirm step. That means the dialog cannot offer to write
 * something it has not got — and the write itself stays with the host, because
 * the NOTE is the notes context's to update.
 */

export interface NoteTemplateApplyPending extends TemplateApplyItem {
  content: string;
}

export interface NoteTemplateApply {
  open: boolean;
  templates: TemplateApplyItem[];
  loading: boolean;
  /** The template awaiting confirmation, or null while still picking. */
  pending: NoteTemplateApplyPending | null;
  /** Open the picker and (re)read the list. */
  begin: () => void;
  pick: (id: string) => void;
  /** Close the whole thing, picked template and all. */
  close: () => void;
}

export function useNoteTemplateApply(
  dataService?: DataService,
): NoteTemplateApply {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateApplyItem[] | null>(null);
  const [pending, setPending] = useState<NoteTemplateApplyPending | null>(null);

  const begin = useCallback(() => {
    if (!dataService) return;
    setPending(null);
    setOpen(true);
    // Re-read on every open: a template registered a minute ago has to be in
    // the list, and the list is the only place it can be seen from here.
    setTemplates(null);
    dataService
      .listNoteTemplatesUnified()
      .then((rows) =>
        setTemplates(rows.map((r) => ({ id: r.id, title: r.title }))),
      )
      .catch((e) => {
        console.error("listNoteTemplatesUnified failed", e);
        // An empty list rather than a permanent spinner — the dialog then says
        // there is nothing to apply, which is the honest state after a failed
        // read as much as after an empty one.
        setTemplates([]);
      });
  }, [dataService]);

  const pick = useCallback(
    (id: string) => {
      if (!dataService) return;
      const row = (templates ?? []).find((tpl) => tpl.id === id);
      void dataService
        .getNoteUnified(id)
        .then((full) => {
          if (full == null) return;
          setPending({
            id: full.id,
            title: row?.title ?? full.title,
            content: full.content,
          });
        })
        .catch((e) => console.error("getNoteUnified (template) failed", e));
    },
    [dataService, templates],
  );

  const close = useCallback(() => {
    setOpen(false);
    setPending(null);
  }, []);

  return {
    open,
    templates: templates ?? [],
    loading: open && templates === null,
    pending,
    begin,
    pick,
    close,
  };
}
