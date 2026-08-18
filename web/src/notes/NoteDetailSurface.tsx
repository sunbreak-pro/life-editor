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
  /** Kebab entry that opens the templates surface (#1047). */
  createTemplate: string;
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
  /**
   * The note's item links, rendered right of the tag row (#884). Optional
   * because the host only builds the panel where it can also supply the
   * cross-role candidate pool and the navigation route.
   */
  linksSlot?: ReactNode;
  /** Open the note templates surface from the kebab (#1047). */
  onOpenTemplates?: () => void;
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
  linksSlot,
  onOpenTemplates,
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
      onOpenTemplates={onOpenTemplates}
      createTemplateLabel={labels.createTemplate}
      tagsSlot={
        // No leading caption (#1042). The row used to open with the shared
        // kind badge (itemRole="note", #412), which spelled out "Note" one line
        // under a note's own title on the only surface that can't be showing
        // anything else — and it sat immediately left of the "+ Tag" button, so
        // the header read "Note / Tag" as if the two were a pair. The pills and
        // the "+ Tag" affordance already say what the row is. The badge stays
        // where it still earns its place: the todo detail and the tag editor's
        // item list, where the row IS about which kind of thing is tagged.
        <TagPicker itemId={note.id} size="sm" />
      }
      linksSlot={linksSlot}
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
