import { X } from "lucide-react";
import { cn } from "../cn";
import { ItemRoleBadge } from "../items/ItemRoleBadge";
import { type TagEditItem, type TagEditModalLabels } from "./types";

interface TaggedItemListProps {
  items: readonly TagEditItem[];
  onUnassign?: (assignmentId: string) => void;
  labels: TagEditModalLabels;
}

/*
 * The items carrying the selected tag (#409), rendered in the order the host
 * supplied (grouped by kind — see itemRoleSortKey), so the badges form runs
 * instead of alternating. Each row is kind badge + title + remove; removal
 * detaches the tag from that item, it never deletes the item.
 */
export function TaggedItemList({
  items,
  onUnassign,
  labels,
}: TaggedItemListProps) {
  if (items.length === 0) {
    return (
      <p className="py-2 text-[12.5px] text-lumen-text-tertiary">
        {labels.itemsEmpty}
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <li
          key={item.assignmentId}
          className="flex items-center gap-2 rounded-lumen-sm px-1.5 py-1 hover:bg-lumen-hover"
        >
          <ItemRoleBadge role={item.role} labels={labels.roles} />
          <span
            className="min-w-0 flex-1 truncate text-[12.5px] text-lumen-text"
            title={item.title}
          >
            {item.title}
          </span>
          <button
            type="button"
            onClick={() => onUnassign?.(item.assignmentId)}
            aria-label={`${labels.unassignLabel}: ${item.title}`}
            title={labels.unassignLabel}
            className={cn(
              "shrink-0 rounded-lumen-sm p-0.5 text-lumen-text-tertiary",
              "transition-colors hover:bg-lumen-danger-subtle hover:text-lumen-danger",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
              // #1562: 32x32 on a phone, and icon-only, so it needs the floor
              // on BOTH axes — the painted glyph stays 13px either way.
              "max-md:inline-flex max-md:min-h-11 max-md:min-w-11",
              "max-md:items-center max-md:justify-center",
            )}
          >
            <X size={13} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
