import { cn } from "../cn";
import { TagHeadingIcon } from "../TagHeadingIcon";
import { SidebarFilterField } from "../materials/SidebarFilterField";
import type { TagHubLabels, TagHubTagSummary } from "./types";

/*
 * The hub's master column (#1171): a filter and the tag list, and nothing that
 * edits. Deliberately the same row shape as the tag editor's TagMasterList
 * (#740) — glyph, name, count — because these are two views of one set of
 * tags and a user who learns one row should recognise the other.
 *
 * Where it differs, and why: this list carries the UNTAGGED bucket, drawn
 * below a rule at the end. It is a pseudo-tag, so it gets the default glyph
 * and no tint, and the separator is what stops it reading as a tag someone
 * actually named "Untagged".
 *
 * Pure presentation: copy is injected (§6.4), lumen-* tokens only, opaque
 * surfaces (§5).
 */

export interface TagHubTagRailProps {
  /** Every tag, untagged last — the model's order is rendered as given. */
  tags: readonly TagHubTagSummary[];
  /** The subset surviving the filter, in the same order. */
  visibleTags: readonly TagHubTagSummary[];
  selectedId: string | null;
  onSelect: (tagId: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** Count → its accessible text ("3 items"), so the number is announced. */
  formatCount: (count: number) => string;
  /** Wide = a fixed rail beside the items; narrow = the whole screen. */
  wide: boolean;
  labels: TagHubLabels;
}

export function TagHubTagRail({
  tags,
  visibleTags,
  selectedId,
  onSelect,
  query,
  onQueryChange,
  formatCount,
  wide,
  labels,
}: TagHubTagRailProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col",
        wide ? "w-[260px] shrink-0 border-r border-lumen-border" : "flex-1",
      )}
    >
      {/* Hidden while there is nothing to narrow — an empty hub should show
          its "no tags yet" copy, not a search box (same rule as #368). */}
      {tags.length > 0 && (
        <div className="flex-shrink-0 border-b border-lumen-border px-3 py-2.5">
          <SidebarFilterField
            value={query}
            onChange={onQueryChange}
            placeholder={labels.filterPlaceholder}
            ariaLabel={labels.filterLabel}
            size="sm"
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
              const active = tag.id === selectedId;
              const countText = formatCount(tag.count);
              return (
                <li
                  key={tag.id}
                  className={cn(
                    // The rule above the untagged bucket. Applied to the <li>
                    // rather than drawn as a separate element so the list stays
                    // one row per tag for a screen reader.
                    tag.isUntagged &&
                      "mt-1 border-t border-lumen-border pt-1.5",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(tag.id)}
                    aria-current={active ? "true" : undefined}
                    // Spelled out rather than left to the concatenated content,
                    // so the count is announced with the name instead of as a
                    // loose number after it.
                    aria-label={`${tag.name}: ${countText}`}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lumen-md px-2 py-1.5 text-left",
                      "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                      active
                        ? "bg-lumen-accent-subtle text-lumen-text"
                        : "text-lumen-text hover:bg-lumen-hover",
                    )}
                  >
                    <TagHeadingIcon icon={tag.icon} color={tag.color} />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm",
                        tag.isUntagged && "text-lumen-text-secondary",
                      )}
                    >
                      {tag.name}
                    </span>
                    <span
                      aria-hidden
                      className="shrink-0 rounded-full bg-lumen-bg-secondary px-2 py-0.5 text-xs font-medium tabular-nums text-lumen-text-secondary"
                    >
                      {tag.count}
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
