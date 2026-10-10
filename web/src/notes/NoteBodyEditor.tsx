import { useRef } from "react";
import type { Editor } from "@tiptap/core";
import {
  logServiceError,
  NoteConflictBanner,
  useBodySyncSession,
  useTranslation,
  type NoteBodySaveResult,
  type NoteBodySnapshot,
  type NoteNode,
} from "@life-editor/shared";
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
 *
 * #2057 — the body is saved against the version it was opened at, and a
 * write from somewhere else while the note is open is no longer overwritten.
 * The session (useBodySyncSession) lives under the same key as the editor, so
 * every open — and every template apply — starts from the body on screen. A
 * write from elsewhere replaces the body when nothing is pending, and raises
 * the conflict banner when something is.
 */

/**
 * What the body needs from the notes hook to save against a version (#2057).
 * The NotesUnified context value satisfies it as is.
 */
export interface NoteBodySync {
  saveNoteBody: (
    id: string,
    content: string,
    expectedUpdatedAt: string | null,
  ) => Promise<NoteBodySaveResult>;
  fetchNoteBodySnapshot: (id: string) => Promise<NoteBodySnapshot | null>;
  adoptNoteBody: (id: string, content: string) => void;
  serverStampOf: (id: string) => string | null;
}

export interface NoteBodyEditorProps {
  note: NoteNode;
  linking: NoteLinking;
  onNavigateToItem?: (target: { id: string; role: string }) => void;
  /** Version-checked persistence of the body (#2057). */
  bodySync: NoteBodySync;
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
  /**
   * The editor instance for the formatting bar in the detail header (#2060),
   * forwarded verbatim to RichTextEditor. Called with null when this body
   * goes away.
   */
  onEditorChange?: (editor: Editor | null) => void;
  className?: string;
}

export function NoteBodyEditor(props: NoteBodyEditorProps) {
  const { note, remountToken = 0 } = props;
  return <NoteBodySession key={`${note.id}:${remountToken}`} {...props} />;
}

function NoteBodySession({
  note,
  linking,
  onNavigateToItem,
  bodySync,
  attachments,
  onEditorChange,
  className,
}: NoteBodyEditorProps) {
  const { t } = useTranslation();
  const readEditorRef = useRef<(() => string | null) | null>(null);
  const noteId = note.id;
  const serverStamp = bodySync.serverStampOf(noteId);

  const session = useBodySyncSession({
    initial: { content: note.content, updatedAt: serverStamp },
    remoteUpdatedAt: serverStamp,
    save: (content, expected) =>
      bodySync.saveNoteBody(noteId, content, expected),
    fetchCurrent: () => bodySync.fetchNoteBodySnapshot(noteId),
    readEditor: () => readEditorRef.current?.() ?? null,
    // #372: drop inline-origin edges whose "[[ ]]" left the text — once the
    // body is actually stored, not on a save that may yet be refused.
    onSaved: (content) => linking.handleBodySaved(noteId, content),
    onAdopted: (content) => bodySync.adoptNoteBody(noteId, content),
    onError: (e) => logServiceError("Notes", "saveNoteBody", e),
  });

  return (
    <>
      {session.conflict && (
        <NoteConflictBanner
          hunks={session.conflict.merge.hunks}
          onKeepMine={() => session.resolve("mine")}
          onTakeTheirs={() => session.resolve("theirs")}
          onKeepBoth={() => session.resolve("both")}
          labels={{
            message: t("materials.notes.conflict.message"),
            showDiff: t("materials.notes.conflict.showDiff"),
            hideDiff: t("materials.notes.conflict.hideDiff"),
            keepMine: t("materials.notes.conflict.keepMine"),
            takeTheirs: t("materials.notes.conflict.takeTheirs"),
            keepBoth: t("materials.notes.conflict.keepBoth"),
            mineHeading: t("materials.notes.conflict.mineHeading"),
            theirsHeading: t("materials.notes.conflict.theirsHeading"),
            changedByMine: t("materials.notes.conflict.changedByMine"),
            changedByTheirs: t("materials.notes.conflict.changedByTheirs"),
            changedByBoth: t("materials.notes.conflict.changedByBoth"),
            changedAlike: t("materials.notes.conflict.changedAlike"),
            emptyBlock: t("materials.notes.conflict.emptyBlock"),
            noTextDiff: t("materials.notes.conflict.noTextDiff"),
          }}
        />
      )}
      <RichTextEditor
        noteId={noteId}
        initialContent={note.content || undefined}
        editable={!note.isEditLocked}
        placeholder={t("materials.notes.bodyPlaceholder")}
        onUpdate={session.commit}
        onDirty={session.markDirty}
        replaceContent={session.replacement}
        contentReaderRef={readEditorRef}
        // "[[" wiki-link autocomplete + click navigation (Issue #285).
        // loadLinkTargets is a LOADER, so handing it over costs nothing until
        // the user actually types "[[" (#430 — typing prose must not fetch the
        // pool).
        loadLinkTargets={linking.loadLinkTargets}
        onNavigateToItem={onNavigateToItem}
        onResolvedLinkInserted={(targetId) =>
          linking.handleResolvedLinkInserted(noteId, targetId)
        }
        onCreateNoteForLink={linking.handleCreateNoteForLink}
        attachments={attachments}
        onEditorChange={onEditorChange}
        className={className}
      />
    </>
  );
}
