import { cn } from "../cn";
import { TagHeadingIcon } from "../TagHeadingIcon";
import { SidebarFilterField } from "../materials/SidebarFilterField";
import { NO_EDITS, type TagRowEdits, type TagRowPatch } from "./tagRowPatch";
import { type TagEditModalLabels, type TagEditRow } from "./types";

interface TagMasterListProps {
  tags: readonly TagEditRow[];
  visibleTags: readonly TagEditRow[];
  edits: Readonly<Record<string, TagRowEdits>>;
  patchByTag: ReadonlyMap<string, TagRowPatch>;
  selectedId: string | null;
  onSelect: (tagId: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  formatCount: (count: number) => string;
  wide: boolean;
  labels: TagEditModalLabels;
}

/*
 * The master column (#740): filter + the tag list, and nothing that edits.
 *
 * Each row is one button carrying the tag's glyph, its name and its count —
 * three read-only things, so the column's width is the same whatever state the
 * panel is in. A tag holding unsaved edits shows its DRAFT name (the same
 * overlay the editor reads) plus an accent dot, so the list and the editor
 * never disagree about what the tag is currently called.
 */
export function TagMasterList({
  tags,
  visibleTags,
  edits,
  patchByTag,
  selectedId,
  onSelect,
  query,
  onQueryChange,
  formatCount,
  wide,
  labels,
}: TagMasterListProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col",
        // A fixed rail beside the editor; the whole panel on a phone.
        wide ? "w-[260px] shrink-0 border-r border-lumen-border" : "flex-1",
      )}
    >
      {/* Filter row (#368). Hidden while there is nothing to narrow — an empty
          panel should show its "no tags yet" copy, not a search box. */}
      {tags.length > 0 && (
        <div className="flex-shrink-0 border-b border-lumen-border px-3 py-2.5">
          <SidebarFilterField
            value={query}
            onChange={onQueryChange}
            placeholder={labels.filterPlaceholder}
            ariaLabel={labels.filterLabel}
            size="md"
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {tags.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-lumen-text-tertiary">
            {labels.empty}
          </p>
        ) : visibleTags.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-lumen-text-tertiary">
            {labels.filterEmpty}
          </p>
        ) : (
          <ul aria-label={labels.listLabel} className="flex flex-col gap-0.5">
            {visibleTags.map((tag) => {
              const rowEdits = edits[tag.id] ?? NO_EDITS;
              const name = rowEdits.name ?? tag.name;
              const color =
                rowEdits.color !== undefined ? rowEdits.color : tag.color;
              const icon =
                rowEdits.icon !== undefined ? rowEdits.icon : tag.icon;
              const rowDirty = patchByTag.has(tag.id);
              const active = tag.id === selectedId;
              const countText = formatCount(tag.count);
              return (
                <li key={tag.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(tag.id)}
                    aria-current={active ? "true" : undefined}
                    // Spelled out rather than left to the concatenated content,
                    // so the count is announced with the name instead of as a
                    // loose number after it.
                    aria-label={`${name}: ${countText}`}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lumen-md px-2 py-1.5 text-left",
                      "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                      active
                        ? "bg-lumen-accent-subtle text-lumen-text"
                        : "text-lumen-text hover:bg-lumen-hover",
                    )}
                  >
                    <TagHeadingIcon icon={icon} color={color} />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {name}
                    </span>
                    {/* The unsaved marker (#740): the save button no longer
                        appears and disappears, so the list is where a draft on
                        a tag you are not looking at stays visible. */}
                    {rowDirty && (
                      <span
                        aria-hidden
                        className="size-1.5 shrink-0 rounded-full bg-lumen-accent"
                      />
                    )}
                    <span
                      aria-hidden
                      className="shrink-0 rounded-full bg-lumen-bg-secondary px-2 py-0.5 text-xs font-medium tabular-nums text-lumen-text-secondary"
                    >
                      {countText}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
