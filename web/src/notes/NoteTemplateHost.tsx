import { useCallback, useEffect, useState } from "react";
import {
  NoteTemplatePanel,
  ResponsiveDetailFrame,
  generateId,
  useTranslation,
  type DataService,
  type NoteNode,
  type NoteTemplateSummary,
} from "@life-editor/shared";
import { RichTextEditor } from "./RichTextEditor";

/*
 * Note templates (#1047) — the wired half.
 *
 * Reached from the note detail's kebab ("テンプレートを作成する"), and framed by
 * width the same way Schedule's todo detail is: a body-level overlay on Desktop,
 * a full-height sheet on Mobile — which is what "Mobile は画面遷移" asks for,
 * since the sheet covers the screen (<ResponsiveDetailFrame>).
 *
 * WHY THIS TALKS TO THE DataService DIRECTLY, unlike everything else in
 * NotesView: a template IS a notes row (items_meta role='note' +
 * notes_payload.note_type='template'), but it must never enter the note list,
 * the search results, the badge count or Trash — so the reads that feed those
 * filter it out, and NotesUnifiedContext consequently never holds one. Routing
 * templates through that context would mean teaching it to carry rows it also
 * has to hide from every consumer it has.
 *
 * Writes go straight out and the local list is patched to match, which is the
 * one place this differs from a note: there is no optimistic tree to reconcile,
 * because nothing else on screen is showing templates.
 *
 * Editing model is the note's, not the todo's: the name commits on blur/Enter
 * and the body autosaves on the editor's own debounce. A template is a scratch
 * surface you leave when it looks right — a save button would be a step between
 * that and nothing.
 */

export interface NoteTemplateHostProps {
  dataService: DataService;
  open: boolean;
  /** Desktop overlay vs the Mobile full-height sheet. */
  isWide: boolean;
  onClose: () => void;
  /**
   * Pour a template into a NEW note. The write is the notes context's (the note
   * has to land in the list the user is looking at), so the host above owns it.
   */
  onUseTemplate: (title: string, content: string) => void;
}

export function NoteTemplateHost({
  dataService,
  open,
  isWide,
  onClose,
  onUseTemplate,
}: NoteTemplateHostProps) {
  const { t } = useTranslation();
  // `null` = never loaded. Loading is DERIVED from that rather than kept in its
  // own flag, because a flag would have to be raised in the effect body — which
  // is the cascading-render pattern react-hooks/set-state-in-effect bans. Every
  // setState below therefore happens in a promise callback, after the await.
  const [templates, setTemplates] = useState<NoteTemplateSummary[] | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fetched, setFetched] = useState<NoteNode | null>(null);
  const [name, setName] = useState("");

  const loading = open && templates === null;
  // The fetched body belongs to the row that is selected NOW. Deriving this
  // rather than clearing `fetched` on deselect keeps the "nothing selected"
  // branch out of the effect, and closes the window where a slow fetch could
  // land under a different selection.
  const selected =
    fetched != null && fetched.id === selectedId ? fetched : null;

  const untitled = t("materials.templates.untitled");

  // Load on open. Closing keeps the list — reopening the panel in the same
  // session should not blank out while it refetches something it already had.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    dataService
      .listNoteTemplatesUnified()
      .then((rows) => {
        if (cancelled) return;
        setTemplates(rows.map((r) => ({ id: r.id, title: r.title })));
      })
      .catch((e) => {
        console.error("listNoteTemplatesUnified failed", e);
        // An empty list rather than a permanent spinner: the panel still offers
        // "new template", which is the one thing that works without the read.
        if (!cancelled) setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, dataService]);

  // The list carries no bodies (same M1 arrangement as notes), so selecting one
  // fetches it. The editor stays unmounted until it lands — mounting it over an
  // empty body is how #475 saved that emptiness over the real one.
  useEffect(() => {
    if (selectedId == null) return;
    let cancelled = false;
    dataService
      .getNoteUnified(selectedId)
      .then((row) => {
        if (cancelled || row == null) return;
        setFetched(row);
        setName(row.title);
      })
      .catch((e) => console.error("getNoteUnified (template) failed", e));
    return () => {
      cancelled = true;
    };
  }, [selectedId, dataService]);

  const handleCreate = useCallback(() => {
    const id = generateId("note");
    const now = new Date().toISOString();
    const node: NoteNode = {
      id,
      type: "template",
      title: untitled,
      content: "",
      parentId: null,
      order: 0,
      isPinned: false,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };
    void dataService
      .createNoteUnified(node)
      .then((created) => {
        setTemplates((prev) => [
          { id: created.id, title: created.title },
          ...(prev ?? []),
        ]);
        // Seed the body locally: the select effect will not refetch a row it
        // was handed, and the new template has nothing to fetch yet anyway.
        setFetched(created);
        setName(created.title);
        setSelectedId(created.id);
      })
      .catch((e) => console.error("createNoteUnified (template) failed", e));
  }, [dataService, untitled]);

  const handleNameCommit = useCallback(() => {
    if (selected == null) return;
    const next = name.trim();
    if (next === selected.title) return;
    setFetched({ ...selected, title: next });
    setTemplates((prev) =>
      (prev ?? []).map((tpl) =>
        tpl.id === selected.id ? { ...tpl, title: next } : tpl,
      ),
    );
    void dataService
      .updateNoteUnified(selected.id, { title: next })
      .catch((e) => console.error("updateNoteUnified (template) failed", e));
  }, [dataService, name, selected]);

  const handleBodyUpdate = useCallback(
    (content: string) => {
      if (selected == null) return;
      // Local copy first: "use this template" reads the body from here, and a
      // press that lands before the write returns must still carry what is on
      // screen.
      setFetched((prev) => (prev == null ? prev : { ...prev, content }));
      void dataService
        .updateNoteUnified(selected.id, { content })
        .catch((e) => console.error("updateNoteUnified (template) failed", e));
    },
    [dataService, selected],
  );

  const handleDelete = useCallback(
    (id: string) => {
      setTemplates((prev) => (prev ?? []).filter((tpl) => tpl.id !== id));
      if (id === selectedId) setSelectedId(null);
      // Soft delete, like a note — but a deleted template does NOT surface in
      // Trash (the trash read filters templates out with the same keep clause
      // the list uses), so the row is recoverable in the DB and gone from the
      // UI. Templates are cheap to rewrite; a Trash section that mixed stamps
      // in with notes would cost more than it saved.
      void dataService
        .softDeleteNoteUnified(id)
        .catch((e) =>
          console.error("softDeleteNoteUnified (template) failed", e),
        );
    },
    [dataService, selectedId],
  );

  const handleUse = useCallback(() => {
    if (selected == null) return;
    onUseTemplate(selected.title, selected.content);
    onClose();
  }, [onClose, onUseTemplate, selected]);

  return (
    <ResponsiveDetailFrame
      wide={isWide}
      open={open}
      title={t("materials.templates.title")}
      closeLabel={t("detailPanel.close")}
      onClose={onClose}
    >
      <NoteTemplatePanel
        templates={templates ?? []}
        selectedId={selectedId}
        loading={loading}
        onSelect={setSelectedId}
        onCreate={handleCreate}
        onDelete={handleDelete}
        onUse={handleUse}
        name={name}
        onNameChange={setName}
        onNameCommit={handleNameCommit}
        bodyEditor={
          selected && (
            // No loadLinkTargets / onCreateNoteForLink: "[[" is off here, so a
            // template cannot carry links (#1047 DoD). The editor ignores
            // initialContent after mount, so the template id is the remount
            // signal.
            <RichTextEditor
              key={selected.id}
              noteId={selected.id}
              initialContent={selected.content || undefined}
              placeholder={t("materials.templates.bodyPlaceholder")}
              onUpdate={handleBodyUpdate}
            />
          )
        }
        labels={{
          listHeading: t("materials.templates.listHeading"),
          empty: t("materials.templates.empty"),
          newTemplate: t("materials.templates.new"),
          nameLabel: t("materials.templates.nameLabel"),
          namePlaceholder: t("materials.templates.namePlaceholder"),
          untitled,
          contentLabel: t("materials.templates.content"),
          delete: t("materials.templates.delete"),
          use: t("materials.templates.use"),
          pickHint: t("materials.templates.pickHint"),
          noTagsHint: t("materials.templates.noTagsHint"),
          loading: t("common.loading"),
        }}
      />
    </ResponsiveDetailFrame>
  );
}
