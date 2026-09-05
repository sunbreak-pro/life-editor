import { TemplateEditPanel, useTranslation } from "@life-editor/shared";
import { RichTextEditor } from "./RichTextEditor";
import type { NoteTemplateLibrary } from "./hooks/useNoteTemplateLibrary";

/*
 * The centre panel that edits one saved template (#1180) — the wired half.
 *
 * A separate file from NotesView for one reason: the TipTap editor. Naming
 * <RichTextEditor> statically is only allowed inside the already-lazy Notes
 * chunk (web/tests/lazyEditorChunk.test.ts keeps the list), and keeping that
 * import in a leaf beside the other editor hosts is what makes the guard's
 * allow-list readable instead of "and also the 600-line view".
 *
 * No "[[" loader and no create-note callback: a template carries no links
 * (#1047), so the affordance is absent here rather than merely hidden.
 *
 * DRAFT MODE (`onDraftChange`, #713) rather than `onUpdate`: this panel commits
 * from its own Save button. The default path debounces 800ms and flushes on
 * unmount, which would both lose the last keystrokes to a quick Save and write
 * on the Cancel that was supposed to discard them.
 */

export interface TemplateEditHostProps {
  library: NoteTemplateLibrary;
  /**
   * Measured width of the note column this panel opens over (#1471) — the view
   * owns the element, so it does the measuring and this only forwards.
   */
  columnWidth?: number | null;
}

export function TemplateEditHost({
  library,
  columnWidth,
}: TemplateEditHostProps) {
  const { t } = useTranslation();
  const draft = library.draft;

  return (
    <TemplateEditPanel
      open={draft != null}
      name={draft?.title ?? ""}
      onNameChange={library.setDraftName}
      onCancel={library.cancelEdit}
      onSave={library.saveEdit}
      columnWidth={columnWidth}
      bodyEditor={
        draft && (
          // The editor ignores initialContent after mount, so the template id
          // is the remount signal — and `initialContent` is the body AS OPENED
          // rather than the live draft, which would otherwise re-seed the
          // editor from its own output on every keystroke.
          <RichTextEditor
            key={draft.id}
            noteId={draft.id}
            initialContent={draft.initialContent || undefined}
            placeholder={t("materials.templates.bodyPlaceholder")}
            onDraftChange={library.setDraftContent}
            // Borderless, exactly as NoteBodyEditor mounts it in the note's
            // own detail card (#1363). The editor's default is a bordered box,
            // which drew a second frame inside the panel's — a note being
            // written has no such frame, and this body is a note.
            className="pt-1"
          />
        )
      }
      labels={{
        panelTitle: t("materials.templates.editTitle"),
        nameLabel: t("materials.templates.nameLabel"),
        namePlaceholder: t("materials.templates.namePlaceholder"),
        cancel: t("common.cancel"),
        save: t("materials.templates.save"),
      }}
    />
  );
}
