import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type ReactElement,
} from "react";
import type { LucideIcon } from "lucide-react";
import type { Editor, Range } from "@tiptap/core";

/*
 * Slash-command menu (web Notes/Daily editor). The floating panel shown when the
 * user types "/" — headings 1–3 + bullet / ordered / checkbox lists. Pure
 * presentation + keyboard nav; the actual block transform lives on each item's
 * `command` (wired in slashCommand.ts). Labels are injected (i18n stays host-
 * side), lumen-* tokens only.
 *
 * The `command`/`items` props are what TipTap's Suggestion util feeds the
 * ReactRenderer: `command(item)` runs the selected item's block transform via
 * the suggestion pipeline (delete the "/query" range, then apply). The ref
 * exposes onKeyDown so the editor keymap can drive ↑/↓/Enter without stealing
 * focus from the document.
 */

export interface SlashMenuItem {
  /** Stable key + already-translated label. */
  id: string;
  title: string;
  Icon: LucideIcon;
  /** Applied by the Suggestion pipeline when the item is chosen. */
  command: (props: { editor: Editor; range: Range }) => void;
}

export interface SlashMenuHandle {
  /** Returns true when the key was consumed (↑/↓/Enter). */
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface SlashMenuProps {
  items: SlashMenuItem[];
  /** Suggestion's command — call with the picked item to run its transform. */
  command: (item: SlashMenuItem) => void;
  /** Copy shown when the query matches nothing. */
  emptyLabel: string;
}

export const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(
  function SlashMenu({ items, command, emptyLabel }, ref): ReactElement {
    const [selected, setSelected] = useState(0);

    // Reset the highlight whenever the filtered set changes (typing narrows it).
    useEffect(() => setSelected(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: (event) => {
        if (items.length === 0) return false;
        if (event.key === "ArrowUp") {
          setSelected((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
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
        <div className="min-w-[15rem] rounded-lumen-md border border-lumen-border bg-lumen-bg px-3 py-2 text-[13px] text-lumen-text-tertiary shadow-lumen-md">
          {emptyLabel}
        </div>
      );
    }

    return (
      <div
        role="listbox"
        className="max-h-72 min-w-[15rem] overflow-y-auto rounded-lumen-md border border-lumen-border bg-lumen-bg p-1 shadow-lumen-md"
      >
        {items.map((item, index) => {
          const isActive = index === selected;
          const { Icon } = item;
          return (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={isActive}
              onMouseEnter={() => setSelected(index)}
              onMouseDown={(e) => {
                // Keep editor selection — commit on mousedown before blur.
                e.preventDefault();
                command(item);
              }}
              className={[
                "flex w-full items-center gap-2.5 rounded-lumen-sm px-2.5 py-1.5 text-left text-[13px]",
                isActive
                  ? "bg-lumen-accent-subtle text-lumen-text"
                  : "text-lumen-text-secondary hover:bg-lumen-hover",
              ].join(" ")}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lumen-sm border border-lumen-border bg-lumen-bg text-lumen-text-secondary">
                <Icon size={14} aria-hidden />
              </span>
              {item.title}
            </button>
          );
        })}
      </div>
    );
  },
);
