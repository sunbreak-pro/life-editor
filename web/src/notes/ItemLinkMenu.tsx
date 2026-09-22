import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactElement,
} from "react";
import type { LucideIcon } from "lucide-react";
import type { Editor, Range } from "@tiptap/core";

/*
 * itemLink menu (web Notes/Daily editor). The floating panel shown when the
 * user types "[[" — a filtered list of link targets (notes / dailies) plus, at
 * the tail, one fixed action row: "create note & link" (#1688 removed the
 * "insert as an unresolved link" row). Pure presentation + keyboard nav; the actual insert /
 * create transform lives on each item's `command` (wired in
 * itemLinkSuggestion.ts). Structure mirrors SlashMenu 1:1 (listbox, ↑/↓/Enter
 * via a ref, mousedown-commit before blur, lumen-* tokens only) so the two
 * pickers read as one system. Labels are host-injected (i18n stays host-side).
 */

/** Row kind — drives the trailing hint text and the leading icon treatment. */
export type ItemLinkMenuItemKind = "candidate" | "create";

export interface ItemLinkMenuItem {
  /** Stable key (target id, or a synthetic key for the action rows). */
  id: string;
  title: string;
  /** Small trailing hint (role name for candidates; empty for action rows). */
  hint?: string;
  kind: ItemLinkMenuItemKind;
  Icon: LucideIcon;
  /** Applied by the Suggestion pipeline when the item is chosen. */
  command: (props: { editor: Editor; range: Range }) => void;
}

export interface ItemLinkMenuHandle {
  /** Returns true when the key was consumed (↑/↓/Enter). */
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface ItemLinkMenuProps {
  items: ItemLinkMenuItem[];
  /** Suggestion's command — call with the picked item to run its transform. */
  command: (item: ItemLinkMenuItem) => void;
  /** Copy shown when the query matches nothing. */
  emptyLabel: string;
  /**
   * Cap for the list's own scroller, in px — the space the placer found on the
   * chosen side of the caret (#471). Omitted → the default max height.
   */
  maxHeight?: number;
}

export const ItemLinkMenu = forwardRef<ItemLinkMenuHandle, ItemLinkMenuProps>(
  function ItemLinkMenu(
    { items, command, emptyLabel, maxHeight },
    ref,
  ): ReactElement {
    const [selected, setSelected] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);
    /** Set by ↑/↓ only — see the scroll effect below. */
    const movedByKey = useRef(false);

    // Reset the highlight whenever the filtered set changes (typing narrows it).
    useEffect(() => setSelected(0), [items]);

    /*
     * Keep the highlighted row inside the scroller (#1902) — SlashMenu next
     * door carries the reasoning, including why the mouse must not trigger it.
     * Both lists have it because the two pickers are one system, and a fix to
     * one of them alone is a divergence.
     */
    useEffect(() => {
      if (!movedByKey.current) return;
      movedByKey.current = false;
      listRef.current
        ?.querySelector<HTMLElement>(`[data-item-link-index="${selected}"]`)
        ?.scrollIntoView?.({ block: "nearest" });
    }, [selected]);

    useImperativeHandle(ref, () => ({
      onKeyDown: (event) => {
        if (items.length === 0) return false;
        if (event.key === "ArrowUp") {
          movedByKey.current = true;
          setSelected((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          movedByKey.current = true;
          setSelected((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          const item = items[selected];
          if (item) command(item);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="min-w-[16rem] rounded-lumen-md border border-lumen-border bg-lumen-bg px-3 py-2 text-sm text-lumen-text-tertiary shadow-lumen-md">
          {emptyLabel}
        </div>
      );
    }

    return (
      <div
        ref={listRef}
        role="listbox"
        // The inline cap (when the placer supplies one) beats the class — style
        // attribute over stylesheet — so the two never have to agree.
        style={{ maxHeight }}
        className="max-h-72 min-w-[16rem] overflow-y-auto rounded-lumen-md border border-lumen-border bg-lumen-bg p-1 shadow-lumen-md"
      >
        {items.map((item, index) => {
          const isActive = index === selected;
          const { Icon } = item;
          const isAction = item.kind !== "candidate";
          return (
            <button
              key={item.id}
              type="button"
              role="option"
              data-item-link-index={index}
              aria-selected={isActive}
              onMouseEnter={() => setSelected(index)}
              onMouseDown={(e) => {
                // Keep editor selection — commit on mousedown before blur.
                e.preventDefault();
                command(item);
              }}
              className={[
                "flex w-full items-center gap-2.5 rounded-lumen-sm px-2.5 py-1.5 text-left text-sm",
                // Touch sizing below the app's single 768px breakpoint: a 36px
                // row is a mouse target, not a thumb target (44px floor).
                "max-md:min-h-11 max-md:px-3 max-md:text-sm",
                isActive
                  ? "bg-lumen-accent-subtle text-lumen-text"
                  : "text-lumen-text-secondary hover:bg-lumen-hover",
              ].join(" ")}
            >
              <span
                className={[
                  "grid h-6 w-6 shrink-0 place-items-center rounded-lumen-sm border border-lumen-border bg-lumen-bg",
                  isAction
                    ? "text-lumen-text-tertiary"
                    : "text-lumen-text-secondary",
                ].join(" ")}
              >
                <Icon size={14} aria-hidden />
              </span>
              <span
                className={[
                  "min-w-0 flex-1",
                  // #1518: an ACTION row says what it does at its end — "…の
                  // ノートを作成してリンク" — so an ellipsis eats the verb and
                  // leaves a row that names a note and no longer says what
                  // pressing it will do. Now that the menu is capped to the
                  // screen those rows have to fit rather than run off it, so
                  // they wrap onto a second line instead of being cut.
                  // A CANDIDATE is named at its start, where one line and an
                  // ellipsis still identify it.
                  isAction ? "break-words" : "truncate",
                ].join(" ")}
              >
                {item.title}
              </span>
              {item.hint && (
                <span className="shrink-0 text-xs text-lumen-text-tertiary">
                  {item.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  },
);
