import { useMemo, type ReactElement } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  TagHeadingIcon,
  cn,
  useWikiTagsUnifiedContext,
  type WikiTagUnified,
} from "@life-editor/shared";
import { tagDroppableId } from "./useNoteTagDnd";

/*
 * The every-tag drop panel over the flat default list (#2579). That list has
 * no tag headings to drop on, so while one of its rows is held this panel
 * offers every live tag instead, and a drop on one adds it (useNoteTagDnd).
 *
 * Mounted by the list only while a row is held, so the tags are read here,
 * from the tags context, rather than handed down: the host would otherwise
 * compute a list that is drawn only mid-drag. The tag-filter options are not
 * that list either — they hold only the tags the matched notes carry, and an
 * empty tag is a target too.
 *
 * A tag the held note already carries is drawn, but its droppable is off: a
 * drop there would write nothing, and an accent saying "release here" over it
 * would promise a change that does not come.
 */

export interface TagDropTargetsLabels {
  /** The panel's heading, which also names it. */
  title: string;
  /** Shown while a target is under the pointer. */
  release: string;
  /** Shown when the vault has no tag at all. */
  noTags: string;
}

export function TagDropTargets({
  noteId,
  overTagId,
  labels,
}: {
  /** The note being dragged. */
  noteId: string;
  /** The tag target under the pointer, or null. */
  overTagId: string | null;
  labels: TagDropTargetsLabels;
}): ReactElement {
  const { allTags, getTagsForItem } = useWikiTagsUnifiedContext();
  const tags = useMemo(
    () => allTags.filter((tag) => !tag.isDeleted),
    [allTags],
  );
  const carried = new Set(
    getTagsForItem(noteId)
      .filter((a) => !a.isDeleted)
      .map((a) => a.tagId),
  );

  return (
    /*
     * A zero-height sticky box, so the panel lies OVER the list instead of
     * pushing it down. @dnd-kit re-measures the held row whenever the DOM
     * above it changes, and the ghost is placed off that rect: a panel taking
     * room in the flow would move the ghost off the pointer by its own
     * height. Sticky, so a row held far down the list still sees it; over the
     * #2576 group headings (z-[1]), which would otherwise slide over it.
     */
    <div className="sticky top-0 z-[2] h-0">
      <section
        aria-label={labels.title}
        data-testid="note-tag-drop-targets"
        className="flex flex-col gap-1.5 rounded-lumen-md border border-lumen-accent bg-lumen-bg p-2 shadow-lumen-lg"
      >
        <p className="text-xs font-semibold text-lumen-text">{labels.title}</p>
        {tags.length === 0 ? (
          <p className="text-xs text-lumen-text-tertiary">{labels.noTags}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <TagDropTarget
                key={tag.id}
                tag={tag}
                carried={carried.has(tag.id)}
              />
            ))}
          </ul>
        )}
        {/* A line of its own rather than text inside the target: a chip that
          grew under the pointer could wrap to the next line and leave it. */}
        <p aria-live="polite" className="min-h-4 text-[11px] text-lumen-accent">
          {overTagId !== null && !carried.has(overTagId) ? labels.release : ""}
        </p>
      </section>
    </div>
  );
}

function TagDropTarget({
  tag,
  carried,
}: {
  tag: WikiTagUnified;
  carried: boolean;
}): ReactElement {
  const { setNodeRef, isOver } = useDroppable({
    id: tagDroppableId(tag.id),
    disabled: carried,
  });
  return (
    <li
      ref={setNodeRef}
      data-testid="note-tag-drop-target"
      data-over={isOver || undefined}
      aria-disabled={carried || undefined}
      className={cn(
        "flex min-w-0 max-w-full items-center gap-1 rounded-lumen-md border border-dashed px-2 py-1 text-xs",
        isOver
          ? "border-lumen-accent bg-lumen-accent-subtle text-lumen-accent"
          : carried
            ? "border-lumen-border text-lumen-text-tertiary"
            : "border-lumen-border-strong text-lumen-text-secondary",
      )}
    >
      <TagHeadingIcon icon={tag.icon} color={tag.color} size={12} />
      <span className="truncate">{tag.name}</span>
    </li>
  );
}
