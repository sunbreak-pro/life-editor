import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Check, Search, Tag as TagIcon } from "lucide-react";
import { useEscapeLayer } from "../../hooks/useDialogA11y";
import { isImeComposing } from "../../utils/imeGuard";
import { cn } from "../cn";
import { resolveTagIcon } from "../tagIcon";
import { filterTagIcons } from "../tagIconAliases";
import { TagHeadingIcon } from "../TagHeadingIcon";

/**
 * The strings the picker draws, already translated (§6.4). A small bag rather
 * than the whole panel's label set (#1643): the picker moved out of the
 * retired tag modal, and taking that bag with it would have kept every future
 * host owing copy it never shows.
 */
export interface TagIconPickerLabels {
  /** Trigger + group label. */
  iconLabel: string;
  /** "Default / no icon" option. */
  clearIconLabel: string;
  /** Placeholder in the search field above the grid (#1701). */
  searchLabel: string;
  /** Shown in place of the grid when nothing matches what was typed (#1701). */
  noMatchLabel: string;
}

export interface TagIconPickerProps {
  current: string | null;
  color: string | null;
  onPick: (icon: string | null) => void;
  /** Extra classes for the TRIGGER button (the 44px floor on narrow). */
  triggerClassName?: string;
  /**
   * Draw this word beside the glyph on the trigger (#1643). The hub's edit
   * block asks for it because the block is a FORM: a bare 32px glyph reads as
   * the current value there, not as the control that changes it, and every
   * other row of the block pairs its value with a worded control.
   */
  triggerLabel?: string;
  labels: TagIconPickerLabels;
}

/** Inline icon picker: a trigger showing the current (resolved) icon, opening a
 *  searchable curated grid below itself. Mirrors ColorPicker's open/close
 *  semantics. */
export function TagIconPicker({
  current,
  color,
  onPick,
  triggerClassName,
  triggerLabel,
  labels,
}: TagIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  /*
   * Which choice Enter would take. An INDEX into the filtered list rather than
   * a name, because the list is rebuilt on every keystroke and "the first
   * match" is what the user is aiming at while still typing — a remembered
   * name would either vanish from the list or stay selected off-screen.
   *
   * null = no keyboard cursor yet, which is the state an untouched panel opens
   * in. Highlighting a cell nobody aimed at would change how the grid reads on
   * open, and it is the one thing #1701 was not allowed to change.
   */
  const [active, setActive] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const choices = useMemo(() => filterTagIcons(query), [query]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  /*
   * A reopened panel starts from the full grid. Carrying the last query over
   * would show a filtered list with no memory of why, and the field it was
   * typed into scrolled out of sight behind the trigger.
   *
   * The reset lives in the opening EVENT, not in an effect keyed on `open`:
   * clearing state from an effect body is a cascading render (and the lint
   * rule that says so), and the state is being reset because of the click, not
   * because the panel has become visible. Focus stays in an effect, where it
   * belongs — it is the DOM being synchronised to React's state, and the input
   * does not exist until the render that `open` causes.
   */
  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setQuery("");
    setActive(null);
    setOpen(true);
  };

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // Escape closes the grid and stops there. The panel this picker lives in is a
  // dialog whose own Escape handler sits on `document` in the capture phase, so
  // a listener of our own would never be reached — one keypress used to take
  // the grid AND the tag edit modal, throwing away the unsaved name beside it
  // (#1342). Joining the dialog layer stack makes the topmost surface the only
  // one Escape reaches, so a second press is what closes the panel. The hook
  // carries its own IME guard, so the Escape that cancels a conversion does not
  // reach either surface.
  const close = useCallback(() => setOpen(false), []);
  useEscapeLayer({ open, onEscape: close });

  const pick = useCallback(
    (name: string | null) => {
      onPick(name);
      setOpen(false);
    },
    [onPick],
  );

  /*
   * Keyboard in the search field (#1701). ↑ ↓ step ONE candidate, not one grid
   * row: ← → would be the natural within-row keys and they belong to the caret
   * in a text field, so stepping by 8 would leave seven of every eight glyphs
   * unreachable without the mouse. After a query the list is short anyway,
   * which is the case this is for.
   *
   * The IME guard is the first thing here, not a special case for Enter: while
   * a Japanese conversion is open, Enter CONFIRMS the conversion and ↑ ↓ walk
   * the candidate list. Acting on any of them would pick an icon or move the
   * selection out from under a user who is still choosing a word. Escape is
   * guarded the same way inside useEscapeLayer.
   */
  const onSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (isImeComposing(e)) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (choices.length === 0) return;
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => {
        // First press enters the list from the end it points at, so ↑ on an
        // untouched panel reaches the last glyph instead of the first.
        if (i === null) return step === 1 ? 0 : choices.length - 1;
        return (i + step + choices.length) % choices.length;
      });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      // No cursor means nothing is aimed at, so Enter does nothing rather than
      // quietly taking whatever happens to sit first in the grid.
      const name = active === null ? undefined : choices[active];
      if (name) pick(name);
    }
  };

  const ids = useId();
  const gridId = `${ids}-grid`;
  const optionId = (name: string) => `${ids}-${name}`;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={labels.iconLabel}
        aria-expanded={open}
        title={labels.iconLabel}
        onClick={toggle}
        className={cn(
          "flex h-8 items-center justify-center gap-2 rounded-lumen-md border border-lumen-border bg-lumen-bg text-lumen-text-secondary",
          triggerLabel ? "px-2.5 text-sm text-lumen-text" : "w-8",
          "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
          triggerClassName,
        )}
      >
        {/* Resolved through TagHeadingIcon (not a capitalized local) so the
            trigger draws the same glyph as a tag heading without declaring a
            component during render — see that file's note (#364 / #421). */}
        <TagHeadingIcon icon={current} color={color} />
        {triggerLabel}
      </button>

      {open && (
        <div
          role="group"
          aria-label={labels.iconLabel}
          /* Floats over the Modal panel, which is itself bg-lumen-bg — painting
             the popover with the same token left it with zero surface contrast,
             so the rows behind read straight through it (#552). It was never
             literally translucent; bg-secondary is the opaque step that makes
             the lift visible in BOTH themes (see tokens.css), with the
             strong border + lg shadow + z-50 popover stacking Menu.tsx uses.
             `w-max` is load-bearing, not a tidy-up (#1289): this box is
             ABSOLUTE, so its containing block is the trigger — 32px wide — and
             an auto width there shrink-to-fits into whatever that block allows,
             floored by the content's MIN-content width. Tailwind's grid columns
             are `repeat(n, minmax(0, 1fr))`, whose min is literally 0, so the
             floor was the gaps alone and the panel painted ~32px wide while its
             28px icon buttons spilled out of their zero-width tracks across the
             name field beside it. That is what "the icon editor breaks and the
             background falls transparent" was: not a token that resolved to
             nothing, but an opaque surface drawn at a sixth of the width of the
             content sitting on it. ColorPicker never showed it because its
             panel is IN FLOW, so its own width feeds the flex item's. */
          className={cn(
            "absolute left-0 top-9 z-50 w-max rounded-lumen-md p-2",
            "border border-lumen-border-strong bg-lumen-bg-secondary shadow-lumen-lg",
          )}
        >
          {/* Search (#1701). The set is 146 glyphs since #1700, which is past
              what a flat grid can be scanned for, and the names it would be
              scanned BY are lucide's English ones. The field matches those and
              the Japanese table in tagIconAliases.ts, so 「きん」 reaches
              Dumbbell and `dumb` still does too. */}
          <div className="relative mb-1.5">
            <Search
              size={13}
              aria-hidden
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-lumen-text-tertiary"
            />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-expanded
              aria-controls={gridId}
              aria-label={labels.searchLabel}
              aria-activedescendant={
                active !== null && choices[active]
                  ? optionId(choices[active])
                  : undefined
              }
              autoComplete="off"
              placeholder={labels.searchLabel}
              value={query}
              /* Filtering runs on every change, INCLUDING the ones React
                 raises mid-composition — that is what makes a half-typed
                 「きん」 narrow to 「きんとれ」 before the IME commits. Only
                 the keys that would commit or navigate are guarded. */
              onChange={(e) => {
                const next = e.target.value;
                setQuery(next);
                // A typed query aims at its best match, so Enter takes it. An
                // emptied field goes back to having no cursor at all.
                setActive(next.trim() ? 0 : null);
              }}
              onKeyDown={onSearchKeyDown}
              className={cn(
                "w-full rounded-lumen-sm border border-lumen-border bg-lumen-bg py-1 pl-7 pr-2 text-[0.8rem] text-lumen-text",
                "placeholder:text-lumen-text-tertiary",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
              )}
            />
          </div>

          {/* Scroll frame (#1366). The curated set went 26 → 56 → 146, and a
              grid with no cap grows a 28px row per 8 icons — the popover would
              hang past the bottom of the modal, and every future icon would
              push it further. Capping the frame at ~5 rows fixes the panel at
              roughly the height it had with 26 choices no matter how long the
              list gets, and the row clipped at the fold is the affordance that
              says there is more below. `overscroll-contain` keeps a flick past
              the end from scrolling the tag list behind the modal. The explicit
              width is what makes the scrollbar safe: the panel's `w-max`
              measures THIS box, and an overflow box does not reserve gutter in
              its max-content width, so an auto width would let the bar eat into
              the last column. 17rem leaves every one of the 8 tracks ≥ the 28px
              button even with a bar drawn. */}
          <div className="max-h-[10.5rem] w-[17rem] overflow-y-auto overscroll-contain">
            {choices.length === 0 ? (
              /* The empty state keeps the frame's width, so the panel does not
                 collapse to the trigger's 32px the moment a query misses. */
              <p
                role="status"
                className="px-2 py-4 text-center text-[0.75rem] text-lumen-text-secondary"
              >
                {labels.noMatchLabel}
              </p>
            ) : (
              /* The grid becomes the search field's listbox (#1701), which is
                 what lets `aria-activedescendant` name the cell ↑ ↓ moved to
                 while the caret stays in the field. The cells stay real
                 buttons carrying role="option": a mouse or a Tab still
                 operates them exactly as before, and only the announced role
                 changes. Tests that used to reach for the first BUTTON in this
                 group now have to ask for the first OPTION, or they pick up
                 the "Default icon" row below instead. */
              <div
                id={gridId}
                role="listbox"
                aria-label={labels.iconLabel}
                className="grid grid-cols-8 justify-items-center gap-1"
              >
                {choices.map((choiceName, index) => {
                  const Choice = resolveTagIcon(choiceName) ?? TagIcon;
                  const isCurrent = current === choiceName;
                  const isActive = index === active;
                  return (
                    <button
                      key={choiceName}
                      id={optionId(choiceName)}
                      type="button"
                      role="option"
                      aria-label={choiceName}
                      /* Two different "this one" states, and ARIA has a word
                         for each: aria-selected is where the keyboard cursor
                         is, aria-current is the icon this tag already uses.
                         Collapsing them onto aria-selected would tell a screen
                         reader the cursor is somewhere it is not. */
                      aria-selected={isActive}
                      aria-current={isCurrent || undefined}
                      title={choiceName}
                      onClick={() => pick(choiceName)}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lumen-sm text-lumen-text-secondary",
                        "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                        isCurrent && "bg-lumen-accent-subtle text-lumen-accent",
                        // The keyboard cursor. Drawn as a ring rather than the
                        // selected fill so "what Enter takes" stays readable on
                        // top of "what this tag already uses".
                        isActive && "ring-2 ring-lumen-accent",
                      )}
                    >
                      <Choice size={15} aria-hidden />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => pick(null)}
            className={cn(
              "mt-1.5 flex w-full items-center gap-1.5 rounded-lumen-sm px-2 py-1 text-[0.75rem] font-medium text-lumen-text-secondary",
              "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            )}
          >
            <Check
              size={13}
              aria-hidden
              className={current ? "opacity-0" : ""}
            />
            {labels.clearIconLabel}
          </button>
        </div>
      )}
    </div>
  );
}
