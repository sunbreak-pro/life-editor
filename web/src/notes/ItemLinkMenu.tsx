import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import type { LucideIcon } from "lucide-react";
import type { Editor, Range } from "@tiptap/core";
import {
  cn,
  FOCUS_RING,
  isImeComposing,
  useTranslation,
} from "@life-editor/shared";

/*
 * itemLink menu (web Notes/Daily editor). The floating panel shown when the
 * user types "[[" — a filtered list of link targets (notes / dailies) plus, at
 * the tail, one fixed action row: "create note & link" (#1688 removed the
 * "insert as an unresolved link" row). Pure presentation + keyboard nav; the actual insert /
 * create transform lives on each item's `command` (wired in
 * itemLinkSuggestion.ts). Structure mirrors SlashMenu 1:1 (listbox, ↑/↓/Enter
 * via a ref, mousedown-commit before blur, lumen-* tokens only) so the two
 * pickers read as one system. Labels are host-injected (i18n stays host-side),
 * except the menu's heading.
 *
 * #2586: the "[[" menu opens with a grey「リンク」heading, so a list of note
 * titles under the caret says what it is for. The heading is the one string
 * this file translates itself: the labels travel RichTextEditor →
 * itemLinkSuggestion → here, and threading one more through both for a fixed
 * word would widen the change past the menu. It reuses the link panel's
 * `materials.links.panelLabel` — the same word for the same thing — rather
 * than a new key. It is left out of the embedded form (ItemLinkSearchMenu),
 * whose search field already says what the list is.
 */

/** The heading's key — see the note above. */
const HEADING_KEY = "materials.links.panelLabel";

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
  /**
   * Drawn inside another box (ItemLinkSearchMenu, #2288): no border, shadow
   * or minimum width of its own, which the outer box already has.
   */
  embedded?: boolean;
}

export const ItemLinkMenu = forwardRef<ItemLinkMenuHandle, ItemLinkMenuProps>(
  function ItemLinkMenu(
    { items, command, emptyLabel, maxHeight, embedded = false },
    ref,
  ): ReactElement {
    const { t } = useTranslation();
    const [selected, setSelected] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);
    /** Set by ↑/↓ only — see the scroll effect below. */
    const movedByKey = useRef(false);

    // Reset the highlight whenever the filtered set changes (typing narrows
    // it). During render rather than in an effect, which would paint the old
    // highlight first ("Adjust state during render").
    const [itemsSeen, setItemsSeen] = useState(items);
    if (itemsSeen !== items) {
      setItemsSeen(items);
      setSelected(0);
    }

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

    const heading = embedded ? undefined : t(HEADING_KEY);

    if (items.length === 0) {
      // The heading stays on an empty result too: the box is still the link
      // menu, and dropping the title would make it jump as the query narrows.
      return (
        <div
          className={cn(
            "text-sm",
            !embedded &&
              "min-w-[16rem] rounded-lumen-md border border-lumen-border bg-lumen-bg p-1 shadow-lumen-md",
          )}
        >
          {heading !== undefined && (
            <div
              data-item-link-heading=""
              className="px-2.5 pb-1 pt-1 text-xs font-medium text-lumen-text-tertiary"
            >
              {heading}
            </div>
          )}
          <div className="px-3 py-2 text-lumen-text-tertiary">{emptyLabel}</div>
        </div>
      );
    }

    return (
      <div
        ref={listRef}
        role="listbox"
        aria-label={heading}
        // The inline cap (when the placer supplies one) beats the class — style
        // attribute over stylesheet — so the two never have to agree.
        style={{ maxHeight }}
        className={cn(
          "max-h-72 overflow-y-auto",
          !embedded &&
            "min-w-[16rem] scroll-pt-7 rounded-lumen-md border border-lumen-border bg-lumen-bg p-1 shadow-lumen-md",
        )}
      >
        {heading !== undefined && (
          /*
           * Inside the scroller so the placer's cap still bounds the whole
           * box, and sticky so it stays over the rows it names. aria-hidden:
           * a listbox may own only options; the listbox's aria-label carries
           * the same word to a screen reader. scroll-pt-7 above keeps a row
           * reached by ↑ from parking under it.
           */
          <div
            aria-hidden="true"
            data-item-link-heading=""
            className="sticky top-0 z-10 bg-lumen-bg px-2.5 pb-1 pt-1 text-xs font-medium text-lumen-text-tertiary"
          >
            {heading}
          </div>
        )}
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
                // Same highlight and bare icon as SlashMenu (#2586): the two
                // pickers are one system, so the "/" menu's look is not
                // changed alone.
                isActive
                  ? "bg-lumen-hover text-lumen-text"
                  : "text-lumen-text-secondary hover:bg-lumen-hover",
              ].join(" ")}
            >
              <Icon
                aria-hidden
                className={[
                  "h-[0.9rem] w-[0.9rem] shrink-0",
                  isAction
                    ? "text-lumen-text-tertiary"
                    : "text-lumen-text-secondary",
                ].join(" ")}
              />
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

/*
 * #2288 — the same list under a search field, for the floating bar's link
 * button. Under "[[" the query is typed into the document; over a selection
 * there is no such place (typing would replace the selected text), so it is
 * typed here instead. The field drives the list the way the caret does under
 * "[[" — ↑ / ↓ / Enter — and Escape closes. A key that belongs to an open IME
 * conversion is left to the conversion: the Enter that commits kana must not
 * also pick a row.
 */
export interface ItemLinkSearchMenuProps {
  /** The rows for a query (the pool is already loaded when this mounts). */
  itemsFor: (query: string) => ItemLinkMenuItem[];
  command: (item: ItemLinkMenuItem) => void;
  /** Escape in the field. */
  onClose: () => void;
  emptyLabel: string;
  /** Accessible name and placeholder of the field. */
  searchLabel: string;
  /** Room the placer found, in px, for the field and the list together. */
  maxHeight?: number;
}

/** The field's height plus the gap under it, taken off the list's room. */
const SEARCH_FIELD_SPACE = 52;

export function ItemLinkSearchMenu({
  itemsFor,
  command,
  onClose,
  emptyLabel,
  searchLabel,
  maxHeight,
}: ItemLinkSearchMenuProps): ReactElement {
  const [query, setQuery] = useState("");
  const items = useMemo(() => itemsFor(query), [itemsFor, query]);
  const listRef = useRef<ItemLinkMenuHandle>(null);

  return (
    <div className="min-w-[16rem] rounded-lumen-md border border-lumen-border bg-lumen-bg p-1 shadow-lumen-md">
      <input
        type="search"
        // The picker opens on a press of the bar, and the next thing the user
        // does is type the item's name.
        autoFocus
        aria-label={searchLabel}
        placeholder={searchLabel}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (isImeComposing(event)) return;
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
          }
          if (listRef.current?.onKeyDown(event.nativeEvent)) {
            event.preventDefault();
          }
        }}
        className={cn(
          "mb-1 w-full rounded-lumen-sm border border-lumen-border bg-lumen-bg-secondary px-2.5 py-1.5 text-sm text-lumen-text placeholder:text-lumen-text-tertiary",
          "max-md:min-h-11",
          FOCUS_RING,
        )}
      />
      <ItemLinkMenu
        ref={listRef}
        embedded
        items={items}
        command={command}
        emptyLabel={emptyLabel}
        maxHeight={
          maxHeight === undefined
            ? undefined
            : Math.max(maxHeight - SEARCH_FIELD_SPACE, 0)
        }
      />
    </div>
  );
}
