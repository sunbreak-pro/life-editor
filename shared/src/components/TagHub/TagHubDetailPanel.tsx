import { ChevronRight } from "lucide-react";
import { cn } from "../cn";
import { ItemRoleBadge } from "../items/ItemRoleBadge";
import {
  ITEM_ROLE_ORDER,
  type ItemRole,
  type ItemRoleLabels,
} from "../items/itemRole";
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
 *   - its size, by kind, at a glance (bars since #2409) — the main pane shows
 *     the kinds one after another and you scroll to learn the shape of the
 *     topic;
 *   - what was FILED here lately — the main pane orders by the item's own
 *     change date, this one by when the tag was attached (see
 *     recentTaggedItems.ts), which is the "what did I put here" reading.
 *
 * Rows navigate, exactly like the hub's own rows: clicking one hands the item
 * to the shell's item-nav route. No editing of the tag here — that is the tag
 * editor's job (#409), one panel away.
 *
 * No heading of its own (#2409): the main pane beside it already draws the
 * glyph, the name and the total. The breakdown's heading carries the name, so
 * the panel still says which tag it is about when it opens alone in the narrow
 * drawer — which is why the breakdown is drawn for an empty tag too.
 *
 * Pure presentation: data and copy injected (§6.4), lumen-* tokens only,
 * opaque surfaces (§5).
 */

export interface TagHubDetailLabels {
  /** Heading over the per-kind bars, already naming the tag (#2409). */
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

/**
 * The breakdown's rows, in ITEM_ROLE_ORDER (#2409). Every kind gets a row even
 * at zero, so the same bars stand in the same places from tag to tag. A note
 * table (#2094) is the exception: most tags hold none and a permanent fifth
 * bar would say nothing, but when one is filed here it has to be counted, or
 * the bars would not add up to the tag's total.
 */
function breakdownRows(
  groups: readonly TagHubGroup[],
): readonly { role: ItemRole; count: number }[] {
  const counts = new Map(
    groups.map((group) => [group.role, group.items.length]),
  );
  return ITEM_ROLE_ORDER.filter(
    (role) => role !== "table" || counts.has(role),
  ).map((role) => ({ role, count: counts.get(role) ?? 0 }));
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
  const rows = breakdownRows(groups);
  const maxCount = Math.max(0, ...rows.map((row) => row.count));

  return (
    <div className="flex flex-col gap-5">
      <section aria-label={labels.breakdownHeading}>
        <h3 className="mb-1.5 text-xs font-medium text-lumen-text-tertiary">
          {labels.breakdownHeading}
        </h3>
        <ul className="flex flex-col gap-1.5">
          {rows.map(({ role, count }) => (
            <li
              key={role}
              // Fixed outer columns, so every bar starts and ends in the same
              // place and the lengths can be compared by eye.
              className="grid grid-cols-[5.5rem_minmax(0,1fr)_3.5rem] items-center gap-2"
            >
              <span className="min-w-0">
                <ItemRoleBadge role={role} labels={labels.roles} />
              </span>
              {/* Decorative: the count beside it says the same thing in words.
                  One colour for every kind, because length is the only thing
                  the bar encodes and the badge already names the kind. The
                  track is the border token because `bg-secondary` is the
                  panel's own colour in the dark theme, and a zero bar is
                  nothing but its track. */}
              <span
                aria-hidden
                data-kind-bar={role}
                className="h-1.5 overflow-hidden rounded-full bg-lumen-border"
              >
                <span
                  className={cn(
                    "block h-full rounded-full bg-lumen-accent",
                    // A count of 1 beside a count of 500 is still there.
                    count > 0 && "min-w-1",
                  )}
                  style={{
                    width: `${maxCount === 0 ? 0 : (count / maxCount) * 100}%`,
                  }}
                />
              </span>
              <span className="whitespace-nowrap text-right text-xs tabular-nums text-lumen-text-secondary">
                {formatCount(count)}
              </span>
            </li>
          ))}
        </ul>
      </section>

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
                    // The panel opens as a drawer under 768px (#2409).
                    "max-md:min-h-11",
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
