import { ChevronRight } from "lucide-react";
import { cn } from "../cn";
import { ItemRoleBadge } from "../items/ItemRoleBadge";
import type { TagHubGroup, TagHubItem, TagHubLabels } from "./types";

/*
 * The hub's detail column (#1171): one selected tag's items, split by kind.
 *
 * The kind is announced by the group HEADING rather than by a badge on every
 * row — the same ItemRoleBadge the tag editor puts on each row (#409), lifted
 * once to the top of its run. A per-row badge would repeat the same chip down
 * a column of ten todos, which is exactly the noise "種類別に一覧" asks to
 * avoid; the vocabulary (icon shape, tint, name) is identical either way
 * because it comes from the same module.
 *
 * Rows NAVIGATE, they do not edit. Clicking one hands the item to the shell's
 * existing item-nav route, which opens it on its home surface — Materials for a
 * note or daily, Schedule for a todo or event. The hub deliberately carries no
 * "put this on today" control: that entrance belongs to the Calendar sidebar
 * (#1153), and two of them would be two places to look for one decision.
 *
 * Pure presentation: copy injected (§6.4), lumen-* tokens only.
 */

export interface TagHubItemGroupsProps {
  groups: readonly TagHubGroup[];
  onOpenItem: (item: TagHubItem) => void;
  /** Count → its accessible text, for the per-kind heading. */
  formatCount: (count: number) => string;
  labels: TagHubLabels;
}

export function TagHubItemGroups({
  groups,
  onOpenItem,
  formatCount,
  labels,
}: TagHubItemGroupsProps) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <section key={group.role}>
          {/*
           * aria-label rather than the concatenated content: the badge already
           * names the kind and the chip is a bare number, so without it the
           * heading is announced as "Todo 3" with no sense of what 3 counts.
           */}
          <h3
            aria-label={`${labels.roles[group.role]}: ${formatCount(
              group.items.length,
            )}`}
            className="mb-1.5 flex items-center gap-2"
          >
            <ItemRoleBadge role={group.role} labels={labels.roles} />
            <span
              aria-hidden
              className="text-xs font-medium tabular-nums text-lumen-text-tertiary"
            >
              {group.items.length}
            </span>
          </h3>
          <ul className="flex flex-col">
            {group.items.map((item) => (
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
                  <span
                    className="min-w-0 flex-1 truncate text-[13px] text-lumen-text"
                    title={item.title}
                  >
                    {item.title}
                  </span>
                  {item.detail && (
                    <span className="shrink-0 text-xs tabular-nums text-lumen-text-tertiary">
                      {item.detail}
                    </span>
                  )}
                  {/* The affordance that says "this leaves the hub". Decorative
                      — the row's own text is its accessible name. */}
                  <ChevronRight
                    size={14}
                    aria-hidden
                    className="shrink-0 text-lumen-text-tertiary opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
