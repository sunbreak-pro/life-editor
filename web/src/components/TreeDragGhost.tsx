/*
 * Faint drag ghost for the Notes/Tasks trees (DU-G). A translucent copy of
 * the grabbed row's title that trails the cursor for orientation. Rendered
 * inside @dnd-kit's <DragOverlay> portal, so it never moves the list block
 * itself (the source row stays put). Purely a "what am I holding" cue — the
 * accent insertion line / inside-folder wash is the real drop-target signal.
 *
 * The opacity-60 here is on the floating overlay (not a primary container
 * background), so it is exempt from the §6.4 transparency rule. notion
 * tokens only.
 */
export function TreeDragGhost({
  title,
}: {
  title: string;
}): React.ReactElement {
  return (
    <div className="pointer-events-none rounded-md border border-notion-accent bg-notion-bg px-2 py-1.5 text-sm text-notion-text opacity-60 shadow-lg">
      {title || "(untitled)"}
    </div>
  );
}
