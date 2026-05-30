import { memo } from "react";

/*
 * Depth guide-lines for the Notes/Tasks trees (DU-G). Shared by both trees
 * so the two feel identical. 1:1 port of the Desktop
 * `frontend/src/components/Tasks/TaskTree/TaskNodeIndent.tsx`: render one
 * `w-4` guide column per depth level, each with a centered `w-px` vertical
 * rule. For the last child of a parent the deepest column's rule is drawn
 * at half height so it reads as an "elbow" terminating at the row rather
 * than continuing past it.
 *
 * notion tokens only (CLAUDE.md §6.4): `bg-notion-border` for the rule. The
 * `-my-1` cancels the row's `py-1`-ish vertical padding so adjacent rows'
 * rules join into one continuous line.
 */

interface TreeNodeIndentProps {
  depth: number;
  isLastChild?: boolean;
}

export const TreeNodeIndent = memo(function TreeNodeIndent({
  depth,
  isLastChild,
}: TreeNodeIndentProps): React.ReactElement | null {
  if (depth <= 0) return null;

  return (
    <div className="flex shrink-0 self-stretch -my-1" aria-hidden>
      {Array.from({ length: depth }, (_, i) => (
        <div key={i} className="flex w-4 justify-center">
          <div
            className={`w-px bg-notion-border ${
              i === depth - 1 && isLastChild ? "h-1/2 self-start" : "h-full"
            }`}
          />
        </div>
      ))}
    </div>
  );
});
