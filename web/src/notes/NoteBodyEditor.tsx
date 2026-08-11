import { useTranslation, type NoteNode } from "@life-editor/shared";
import { RichTextEditor } from "./RichTextEditor";
import type { NoteLinking } from "./hooks/useNoteLinking";

/*
 * The note body, wired (extracted from NotesView.tsx — #588 split, zero
 * behavior change). Desktop main and the mobile sheet each mount one, and they
 * have to carry the SAME "[[" wiring: #475 was a link click that worked on one
 * surface and not the other, which is exactly what two hand-copied prop lists
 * produce.
 *
 * `key={note.id}` stays here with the editor: RichTextEditor ignores
 * initialContent changes once mounted, so the note id IS the remount signal.
 * The caller decides WHETHER to mount it at all — the mobile sheet holds a
 * skeleton until the body has actually arrived.
 *
 * The body placeholder is read here rather than taken as a prop for the same
 * reason: a prop would have to be passed at both mount sites, and one of them
 * would eventually be forgotten (#680 — the placeholder was nobody's job, so
 * the editor's English default showed on a Japanese screen).
 */

export interface NoteBodyEditorProps {
  note: NoteNode;
  linking: NoteLinking;
  onNavigateToItem?: (target: { id: string; role: string }) => void;
  /** Persist the edited body (the host also runs the link delete-sync). */
  onSave: (noteId: string, content: string) => void;
  className?: string;
}

export function NoteBodyEditor({
  note,
  linking,
  onNavigateToItem,
  onSave,
  className,
}: NoteBodyEditorProps) {
  const { t } = useTranslation();
  return (
    <RichTextEditor
      key={note.id}
      noteId={note.id}
      initialContent={note.content || undefined}
      editable={!note.isEditLocked}
      placeholder={t("materials.notes.bodyPlaceholder")}
      onUpdate={(content) => {
        onSave(note.id, content);
        // #372: drop inline-origin edges whose "[[ ]]" left the text.
        linking.handleBodySaved(note.id, content);
      }}
      // "[[" wiki-link autocomplete + click navigation (Issue #285).
      // loadLinkTargets is a LOADER, so handing it over costs nothing until
      // the user actually types "[[" (#430 — typing prose must not fetch the
      // pool).
      loadLinkTargets={linking.loadLinkTargets}
      onNavigateToItem={onNavigateToItem}
      onResolvedLinkInserted={(targetId) =>
        linking.handleResolvedLinkInserted(note.id, targetId)
      }
      onCreateNoteForLink={linking.handleCreateNoteForLink}
      className={className}
    />
  );
}
