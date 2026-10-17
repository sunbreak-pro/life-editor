import { ChevronRight } from "lucide-react";
import { cn } from "../cn";
import { ItemRoleBadge } from "../items/ItemRoleBadge";
import type { ItemRoleLabels } from "../items/itemRole";
import { TagHeadingIcon } from "../TagHeadingIcon";
import type { TagHubGroup, TagHubItem, TagHubTagSummary } from "./types";

/*
 * What the shared detail panel shows while a tag is open in the hub (#1472).
 *
 * Until now the panel sat beside the hub saying "nothing to show" — a quarter
 * of a 1280px layout, blank, with a tag selected. Every other section puts its
 * selected thing's DETAIL there (the note list, the todo's fields, the
 * Settings categories), and the hub's selected thing is a tag. What a tag has
 * to say about itself that the main pane does not already list:
 *
 *   - its size, by kind, at a glance — the main pane shows the kinds one
 *     after another and you scroll to learn the shape of the topic;
 *   - what was FILED here lately — the main pane orders by the item's own
 *     change date, this one by when the tag was attached (see
 *     recentTaggedItems.ts), which is the "what did I put here" reading.
 *
 * Rows navigate, exactly like the hub's own rows: clicking one hands the item
 * to the shell's item-nav route. No editing of the tag here — that is the tag
 * editor's job (#409), one panel away.
 *
 * Pure presentation: data and copy injected (§6.4), lumen-* tokens only,
 * opaque surfaces (§5).
 */

export interface TagHubDetailLabels {
  /** Heading over the per-kind counts. */
  breakdownHeading: string;
  /** Heading over the recently-filed rows, for a real tag. */
  recentHeading: string;
  /** The same heading for the untagged bucket, which has no "filed" date and
   *  falls back to the item's own change date. */
  recentUntaggedHeading: string;
  /** The tag holds nothing the hub can list. */
  recentEmpty: string;
  /** Kind names, shared with the hub and the tag editor. */
  roles: ItemRoleLabels;
}

export interface TagHubDetailPanelProps {
  tag: TagHubTagSummary;
  /** The tag's groups from the model — the breakdown is read off them. */
  groups: readonly TagHubGroup[];
  /** Already-selected rows (see selectRecentTaggedItems), newest first. */
  recent: readonly TagHubItem[];
  onOpenItem: (item: TagHubItem) => void;
  /** Count → its accessible text ("3 items"). */
  formatCount: (count: number) => string;
  labels: TagHubDetailLabels;
}

export function TagHubDetailPanel({
  tag,
  groups,
  recent,
  onOpenItem,
  formatCount,
  labels,
}: TagHubDetailPanelProps) {
  const recentHeading = tag.isUntagged
    ? labels.recentUntaggedHeading
    : labels.recentHeading;

  return (
    <div className="flex flex-col gap-5">
      {/* The tag itself — the same glyph + name + count the rail row and the
          main pane's heading draw, so the three read as one thing. */}
      <div className="flex items-center gap-2">
        <TagHeadingIcon icon={tag.icon} color={tag.color} size={18} />
        <h2
          className={cn(
            "min-w-0 flex-1 truncate text-sm font-semibold",
            tag.isUntagged ? "text-lumen-text-secondary" : "text-lumen-text",
          )}
        >
          {tag.name}
        </h2>
        <span className="shrink-0 text-xs tabular-nums text-lumen-text-tertiary">
          {formatCount(tag.count)}
        </span>
      </div>

      {groups.length > 0 && (
        <section aria-label={labels.breakdownHeading}>
          <h3 className="mb-1.5 text-xs font-medium text-lumen-text-tertiary">
            {labels.breakdownHeading}
          </h3>
          <ul className="flex flex-col gap-1">
            {groups.map((group) => (
              <li
                key={group.role}
                className="flex items-center justify-between gap-2"
              >
                <ItemRoleBadge role={group.role} labels={labels.roles} />
                <span className="text-xs tabular-nums text-lumen-text-secondary">
                  {formatCount(group.items.length)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label={recentHeading}>
        <h3 className="mb-1.5 text-xs font-medium text-lumen-text-tertiary">
          {recentHeading}
        </h3>
        {recent.length === 0 ? (
          <p className="text-xs text-lumen-text-secondary">
            {labels.recentEmpty}
          </p>
        ) : (
          <ul className="flex flex-col">
            {recent.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpenItem(item)}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-lumen-sm px-2 py-1.5 text-left",
                    "transition-colors hover:bg-lumen-hover",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                  )}
                >
                  {/* Compact: the rows are mixed kinds and the column is
                      narrow, so the kind is one glyph here; the name moves to
                      the glyph's label and is still announced. */}
                  <ItemRoleBadge
                    role={item.role}
                    labels={labels.roles}
                    compact
                  />
                  <span
                    className="min-w-0 flex-1 truncate text-[13px] text-lumen-text"
                    title={item.title}
                  >
                    {item.title}
                  </span>
                  {/* An event's day, as before #2224. Not `detail`: that is
                      the list's second line now (a note's excerpt), which a
                      one-line, unshrinking slot cannot hold. */}
                  {item.date && (
                    <span className="shrink-0 text-xs tabular-nums text-lumen-text-tertiary">
                      {item.date}
                    </span>
                  )}
                  <ChevronRight
                    size={14}
                    aria-hidden
                    className="shrink-0 text-lumen-text-tertiary opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
