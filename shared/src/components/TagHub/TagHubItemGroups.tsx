import { ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "../cn";
import { FOCUS_RING_TIGHT } from "../styleTokens";
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
  /**
   * Wide = the Desktop detail column; narrow = the whole phone screen. Only
   * the row height depends on it (#1561): narrow rows get the 44px touch
   * floor, wide rows keep their mouse height.
   */
  wide: boolean;
  labels: TagHubLabels;
  /*
   * Bulk selection (#1644 / D8–D9). Without a toggle the rows carry no
   * checkbox and read exactly as before, which is what narrow gets.
   */
  checkedIds?: ReadonlySet<string>;
  onToggleChecked?: (itemId: string) => void;
  /** A row's checkbox name ("Select “Standup”"). */
  formatSelectItem?: (title: string) => string;
  /*
   * Relations selection (#1645 / plan assumption 1). With `onSelectItem` the
   * row's CLICK picks the item for the right panel, and leaving the hub is the
   * chevron — now a button of its own — or a double click. Without it a click
   * opens the item, which is what narrow keeps.
   */
  activeItemId?: string | null;
  onSelectItem?: (item: TagHubItem) => void;
  /** The chevron button's name ("Open “Standup”"). */
  formatOpenItem?: (title: string) => string;
  /*
   * The narrow row's "…" (#1646 / M3). The host owns what it offers — the
   * sheet holds actions that write, and this component writes nothing.
   */
  onItemMenu?: (item: TagHubItem) => void;
  /** That button's name ("Standup: Item actions"). */
  formatItemMenu?: (title: string) => string;
}

export function TagHubItemGroups({
  groups,
  onOpenItem,
  formatCount,
  wide,
  labels,
  checkedIds,
  onToggleChecked,
  formatSelectItem,
  activeItemId,
  onSelectItem,
  formatOpenItem,
  onItemMenu,
  formatItemMenu,
}: TagHubItemGroupsProps) {
  // Once anything is checked every row shows its box (D8), so extending the
  // selection does not mean hunting for a control that appears on hover.
  const anyChecked = (checkedIds?.size ?? 0) > 0;
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
              <li
                key={item.id}
                className={cn(
                  "group/row relative flex items-center rounded-lumen-sm",
                  // The tint plus the 2px bar (D9), so neither a checked
                  // row nor the selected one is told apart by colour alone.
                  (checkedIds?.has(item.id) || activeItemId === item.id) &&
                    "bg-lumen-accent-subtle",
                )}
              >
                {(checkedIds?.has(item.id) || activeItemId === item.id) && (
                  <span
                    aria-hidden
                    className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-lumen-accent"
                  />
                )}
                {onToggleChecked && (
                  <input
                    type="checkbox"
                    checked={checkedIds?.has(item.id) ?? false}
                    onChange={() => onToggleChecked(item.id)}
                    aria-label={formatSelectItem?.(item.title) ?? item.title}
                    className={cn(
                      "ml-2 size-4 shrink-0 cursor-pointer accent-lumen-accent",
                      FOCUS_RING_TIGHT,
                      !anyChecked &&
                        "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100",
                    )}
                  />
                )}
                <button
                  type="button"
                  aria-current={activeItemId === item.id ? "true" : undefined}
                  onClick={() =>
                    onSelectItem ? onSelectItem(item) : onOpenItem(item)
                  }
                  onDoubleClick={
                    onSelectItem ? () => onOpenItem(item) : undefined
                  }
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-lumen-sm px-2 py-1.5 text-left",
                    "transition-colors hover:bg-lumen-hover",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                    // #1561 — 44px touch floor on narrow only (the audit read
                    // 33px here). `min-h-*`, never `h-*`: `cn` is a plain
                    // string join (rules/frontend.md §Gotchas).
                    !wide && "min-h-11",
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
                  {/* Decorative while the row itself opens the item; the
                      button below takes over when it does not. */}
                  {!onSelectItem && (
                    <ChevronRight
                      size={14}
                      aria-hidden
                      className="shrink-0 text-lumen-text-tertiary opacity-0 transition-opacity group-hover/row:opacity-100"
                    />
                  )}
                </button>
                {onItemMenu && (
                  // M3 — narrow has no hover to reveal anything with, so the
                  // row's actions sit on a 44px button of their own.
                  <button
                    type="button"
                    onClick={() => onItemMenu(item)}
                    aria-label={formatItemMenu?.(item.title) ?? item.title}
                    className={cn(
                      "grid size-11 shrink-0 place-items-center rounded-lumen-sm text-lumen-text-secondary",
                      "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
                      FOCUS_RING_TIGHT,
                    )}
                  >
                    <MoreHorizontal size={16} aria-hidden />
                  </button>
                )}
                {onSelectItem && (
                  // Always reachable, never hover-only: with the row's click
                  // taken by selection this is the only pointer route out of
                  // the hub, and a keyboard has no hover to reveal it with.
                  <button
                    type="button"
                    onClick={() => onOpenItem(item)}
                    aria-label={formatOpenItem?.(item.title) ?? item.title}
                    className={cn(
                      "mr-1 shrink-0 rounded-lumen-sm p-1 text-lumen-text-tertiary",
                      "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
                      FOCUS_RING_TIGHT,
                    )}
                  >
                    <ChevronRight size={14} aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
