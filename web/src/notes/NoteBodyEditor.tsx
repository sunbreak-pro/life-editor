import { useTranslation, type NoteNode } from "@life-editor/shared";
import { RichTextEditor } from "./RichTextEditor";
import type { NoteLinking } from "./hooks/useNoteLinking";
import type { AttachmentWiring } from "./useAttachmentUpload";

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
 * `remountToken` (#1181) extends that key for the one case where the body
 * changes UNDER the same note: applying a template replaces it wholesale, and
 * without a second half to the key the editor would keep showing what the user
 * just agreed to throw away.
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
  /**
   * Bump to remount the editor on the SAME note, after the host has replaced
   * its body behind the editor's back (#1181). Default 0 = never remounts for
   * any reason other than a note switch, i.e. the pre-#1181 behaviour.
   */
  remountToken?: number;
  /**
   * Image / file embedding (#1404). Forwarded verbatim — same reason the "[["
   * wiring is passed as one bundle: two mount sites hand-copying half of it is
   * exactly what produced #475.
   */
  attachments?: AttachmentWiring;
  className?: string;
}

export function NoteBodyEditor({
  note,
  linking,
  onNavigateToItem,
  onSave,
  remountToken = 0,
  attachments,
  className,
}: NoteBodyEditorProps) {
  const { t } = useTranslation();
  return (
    <RichTextEditor
      key={`${note.id}:${remountToken}`}
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
      attachments={attachments}
      className={className}
    />
  );
}
