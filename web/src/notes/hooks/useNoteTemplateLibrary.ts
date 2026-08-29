import { useCallback, useEffect, useState } from "react";
import {
  useSyncDomains,
  type DataService,
  type TemplateListItem,
} from "@life-editor/shared";

/*
 * The saved templates behind the Notes sidebar disclosure, and the draft the
 * centre panel edits (#1180).
 *
 * WHY THIS TALKS TO THE DataService DIRECTLY, unlike everything else in
 * NotesView: a template IS a notes row (items_meta role='note' +
 * notes_payload.note_type='template'), but it must never enter the note list,
 * the search results, the badge count or Trash — so the reads that feed those
 * filter it out, and NotesUnifiedContext consequently never holds one. Routing
 * templates through that context would mean teaching it to carry rows it also
 * has to hide from every consumer it has.
 *
 * The list is titles only, like the note list: bodies are fetched when the
 * editor opens. Editing keeps a DRAFT rather than writing through, because the
 * panel's two buttons are the commit — see TemplateEditPanel's header for why a
 * template is edited that way and a note is not.
 *
 * `useSyncDomains("notes")` is declared even though nothing else writes
 * templates today: templates share the notes tables, so a sync push that
 * touches them bumps that counter, and an unread counter is how a list goes
 * quietly stale with no way for the user to refresh it (rules/frontend.md
 * §Sync).
 */

/** The template being edited, as the panel holds it before Save. */
export interface NoteTemplateDraft {
  id: string;
  title: string;
  content: string;
  /** Body at open — the editor is keyed on the id, so this seeds it once. */
  initialContent: string;
}

export interface NoteTemplateLibrary {
  templates: TemplateListItem[];
  loading: boolean;
  listOpen: boolean;
  toggleList: () => void;
  draft: NoteTemplateDraft | null;
  setDraftName: (value: string) => void;
  setDraftContent: (value: string) => void;
  beginEdit: (id: string) => void;
  cancelEdit: () => void;
  saveEdit: () => void;
  remove: (id: string) => void;
  /** Re-read the list. For writes this hook did not make — see #1179 below. */
  refresh: () => void;
}

export function useNoteTemplateLibrary(
  dataService?: DataService,
): NoteTemplateLibrary {
  // `null` = never loaded. Loading is DERIVED from that rather than kept in its
  // own flag, because a flag would have to be raised in the effect body — the
  // cascading-render pattern react-hooks/set-state-in-effect bans. Every
  // setState below therefore happens in a promise callback, after the await.
  const [templates, setTemplates] = useState<TemplateListItem[] | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [draft, setDraft] = useState<NoteTemplateDraft | null>(null);
  const notesVersion = useSyncDomains("notes");
  // Bumped by `refresh()`. The sync counter above only moves on a PUSH, so a
  // template written locally by another hook (#1179 registers one from the note
  // kebab) leaves this list correct-looking and one row short.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!dataService) return;
    let cancelled = false;
    dataService
      .listNoteTemplatesUnified()
      .then((rows) => {
        if (cancelled) return;
        setTemplates(rows.map((r) => ({ id: r.id, title: r.title })));
      })
      .catch((e) => {
        console.error("listNoteTemplatesUnified failed", e);
        // An empty list rather than a permanent spinner: the disclosure still
        // opens and says so, which is the honest state when the read failed.
        if (!cancelled) setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [dataService, notesVersion, reloadToken]);

  const beginEdit = useCallback(
    (id: string) => {
      if (!dataService) return;
      // The row lands in the draft only once the BODY is here. Opening the
      // panel first and filling it in later is how #475 mounted an editor over
      // an empty body and then saved that emptiness over the real one.
      void dataService
        .getNoteUnified(id)
        .then((row) => {
          if (row == null) return;
          setDraft({
            id: row.id,
            title: row.title,
            content: row.content,
            initialContent: row.content,
          });
        })
        .catch((e) => console.error("getNoteUnified (template) failed", e));
    },
    [dataService],
  );

  const setDraftName = useCallback((value: string) => {
    setDraft((prev) => (prev == null ? prev : { ...prev, title: value }));
  }, []);

  const setDraftContent = useCallback((value: string) => {
    setDraft((prev) => (prev == null ? prev : { ...prev, content: value }));
  }, []);

  const cancelEdit = useCallback(() => setDraft(null), []);

  const saveEdit = useCallback(() => {
    if (draft == null || !dataService) return;
    const title = draft.title.trim();
    setTemplates((prev) =>
      (prev ?? []).map((tpl) =>
        tpl.id === draft.id ? { ...tpl, title } : tpl,
      ),
    );
    setDraft(null);
    void dataService
      .updateNoteUnified(draft.id, { title, content: draft.content })
      .catch((e) => console.error("updateNoteUnified (template) failed", e));
  }, [dataService, draft]);

  const remove = useCallback(
    (id: string) => {
      if (!dataService) return;
      setTemplates((prev) => (prev ?? []).filter((tpl) => tpl.id !== id));
      setDraft((prev) => (prev?.id === id ? null : prev));
      // Soft delete, like a note — but a deleted template does NOT surface in
      // Trash (the trash read filters templates out with the same keep clause
      // the list uses), so the row is recoverable in the DB and gone from the
      // UI.
      void dataService
        .softDeleteNoteUnified(id)
        .catch((e) =>
          console.error("softDeleteNoteUnified (template) failed", e),
        );
    },
    [dataService],
  );

  const refresh = useCallback(() => setReloadToken((v) => v + 1), []);

  return {
    templates: templates ?? [],
    loading: templates === null,
    listOpen,
    toggleList: () => setListOpen((v) => !v),
    draft,
    setDraftName,
    setDraftContent,
    beginEdit,
    cancelEdit,
    saveEdit,
    remove,
    refresh,
  };
}
