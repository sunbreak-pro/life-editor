import type { ReactNode } from "react";
import { NoteDetailPanel, LockedBodyGate } from "@life-editor/shared";
import type { NoteNode } from "@life-editor/shared";
import { TagPicker } from "../wikitag";

/*
 * The note detail, as both surfaces render it (extracted from NotesView.tsx —
 * #588 split, zero behavior change).
 *
 * Desktop main content and the mobile sheet host the SAME panel, which is what
 * keeps a field added to the note detail from reaching only one width. The one
 * difference is `variant`: "main" on Desktop (bigger title, page-level), the
 * default inside the sheet.
 *
 * The password gate wraps the BODY ONLY (#526) — title / tags / pin / delete
 * stay usable without the password on both surfaces. It lives here rather than
 * at each call site for the same reason the panel does: #471 shipped the mobile
 * sheet all-or-nothing and the same locked note behaved differently depending
 * on the window width.
 */

export interface NoteDetailLabels {
  title: string;
  pin: string;
  unpin: string;
  /** Name of the "this note is pinned" marker beside the kebab (#885). */
  pinned: string;
  delete: string;
  moreActions: string;
  content: string;
  lockedHint: string;
}

export interface NoteDetailSurfaceProps {
  note: NoteNode;
  /** "main" = the Desktop page surface; omitted = inside the mobile sheet. */
  variant?: "main";
  labels: NoteDetailLabels;
  /** Is this note's body covered by its password right now? */
  locked: boolean;
  onUnlock: (noteId: string) => void;
  onTitleCommit: (noteId: string, title: string) => void;
  onTogglePin: (noteId: string) => void;
  onDelete: (noteId: string) => void;
  /** The body: the editor, or a skeleton while it is still arriving. */
  contentEditor: ReactNode;
}

export function NoteDetailSurface({
  note,
  variant,
  labels,
  locked,
  onUnlock,
  onTitleCommit,
  onTogglePin,
  onDelete,
  contentEditor,
}: NoteDetailSurfaceProps) {
  return (
    <NoteDetailPanel
      variant={variant}
      noteId={note.id}
      title={note.title}
      isPinned={note.isPinned}
      onTitleCommit={onTitleCommit}
      onTogglePin={onTogglePin}
      onDelete={onDelete}
      titleLabel={labels.title}
      pinLabel={labels.pin}
      unpinLabel={labels.unpin}
      pinnedLabel={labels.pinned}
      deleteLabel={labels.delete}
      moreActionsLabel={labels.moreActions}
      tagsSlot={
        // itemRole (#412): the note detail adopts the same kind badge the todo
        // detail uses, so the two tag rows stay one design.
        <TagPicker itemId={note.id} itemRole="note" showLabel size="sm" />
      }
      contentLabel={labels.content}
      contentEditor={
        <LockedBodyGate
          locked={locked}
          hint={labels.lockedHint}
          onUnlock={() => onUnlock(note.id)}
        >
          {contentEditor}
        </LockedBodyGate>
      }
    />
  );
}
