import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Check, ChevronRight, Search, Tag as TagIcon } from "lucide-react";
import { isImeComposing } from "../../utils/imeGuard";
import { cn } from "../cn";
import { Modal } from "../Modal";
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
  /** Strip + panel title + search-list label. */
  iconLabel: string;
  /** "Default / no icon" option, inside the panel. */
  clearIconLabel: string;
  /** Placeholder in the search field at the top of the panel (#1701). */
  searchLabel: string;
  /** Shown in place of the grid when nothing matches what was typed (#1701). */
  noMatchLabel: string;
  /** The button under the strip that opens the panel ("Show more"). */
  moreLabel: string;
  /**
   * The match count above the grid. A template with one `{count}` slot rather
   * than a function: every other string in this bag is plain text a host can
   * hand straight from its catalog, and a single-brace slot is left alone by
   * i18next (its own interpolation is `{{…}}`).
   */
  countLabel: string;
  /**
   * Accessible name of the panel's close (×) button (#2500). The panel fills
   * most of a phone screen, where the backdrop strip left to tap is a few px
   * wide and there is no Esc key, so the panel owes an exit of its own.
   */
  closeLabel: string;
}

export interface TagIconPickerProps {
  current: string | null;
  color: string | null;
  onPick: (icon: string | null) => void;
  labels: TagIconPickerLabels;
}

/**
 * How many glyphs the strip draws before its own clip takes over: the current
 * one plus the first of the curated set. A fixed number, not a measurement —
 * jsdom has no layout (CLAUDE.md §7.1), so a count derived from the width could
 * not be tested, and the row's `overflow-hidden` is what actually decides how
 * many show on a narrow sheet. The number only has to be at least what the
 * widest host can fit.
 */
const STRIP_COUNT = 10;

/** Mobile tap floor (frontend.md §Gotchas: 44px is the caller's job). */
const CELL = "h-8 w-8 max-md:h-11 max-md:w-11";

/**
 * Icon picker: a one-row strip of glyphs (the current one first) with a "show
 * more" button under it. The button opens a panel in the middle of the screen
 * that holds the search field and every icon (#2389).
 *
 * The panel is a Modal rather than a popover hung off the trigger. The old
 * popover had to be sized against whatever sheet it sat in (#1289, #2051), and
 * a 146-glyph grid inside a narrow sheet is more than the sheet can hold
 * either way; a portal'd panel has the whole viewport and cannot be clipped by
 * the surface that opened it.
 */
export function TagIconPicker({
  current,
  color,
  onPick,
  labels,
}: TagIconPickerProps) {
  const [open, setOpen] = useState(false);

  const stripNames = useMemo(
    () =>
      filterTagIcons("")
        .filter((name) => name !== current)
        .slice(0, STRIP_COUNT - 1),
    [current],
  );

  const pick = (name: string | null) => {
    onPick(name);
    setOpen(false);
  };

  return (
    <div className="min-w-0 flex-1">
      {/* The row's overflow is hidden on purpose: whatever does not fit wraps to
          a second line that is cut off, which is how "one row" holds at any
          width without measuring. The 2px padding is room for the focus ring,
          which `overflow-hidden` would otherwise slice off at the top and
          bottom. Glyphs past the fold stay in the tab order (they cannot be
          told apart from visible ones without layout); the panel is where a
          keyboard user is expected to look for anything beyond the first few. */}
      <div
        role="group"
        aria-label={labels.iconLabel}
        className="flex h-9 flex-wrap gap-1 overflow-hidden p-0.5 max-md:h-12"
      >
        <div
          role="img"
          aria-label={current ?? labels.clearIconLabel}
          title={current ?? labels.clearIconLabel}
          className={cn(
            CELL,
            "flex shrink-0 items-center justify-center rounded-lumen-sm bg-lumen-accent-subtle text-lumen-accent",
          )}
        >
          <TagHeadingIcon icon={current} color={color} />
        </div>
        {stripNames.map((name) => {
          const Choice = resolveTagIcon(name) ?? TagIcon;
          return (
            <button
              key={name}
              type="button"
              aria-label={name}
              title={name}
              onClick={() => pick(name)}
              className={cn(
                CELL,
                "flex shrink-0 items-center justify-center rounded-lumen-sm text-lumen-text-secondary",
                "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
              )}
            >
              <Choice size={15} aria-hidden />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          // `whitespace-nowrap` (#2496): squeezed beside a label column the
          // button broke "Show more" over three lines instead of moving.
          "mt-1 flex items-center gap-1 whitespace-nowrap rounded-lumen-sm px-1.5 py-1 text-sm text-lumen-text-secondary max-md:min-h-11",
          "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
        )}
      >
        {labels.moreLabel}
        <ChevronRight size={14} aria-hidden />
      </button>

      {/* `fitViewport` bounds the panel to the screen and scrolls its body, so
          146 glyphs never push the panel past the edge. Esc, the backdrop and
          focus-return all come from Modal; its layer stack is what makes one
          Escape close this panel and leave the sheet or dialog underneath
          standing (#1342's guarantee, kept by a different mechanism).
          `closeLabel` draws Modal's corner × beside the heading (44px under
          768px), outside the scrolling body, so it stays in reach while the
          grid scrolls (#2500). */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={labels.iconLabel}
        closeLabel={labels.closeLabel}
        fitViewport
      >
        <IconPanel current={current} labels={labels} onPick={pick} />
      </Modal>
    </div>
  );
}

interface IconPanelProps {
  current: string | null;
  labels: TagIconPickerLabels;
  onPick: (icon: string | null) => void;
}

/*
 * The panel's contents. A component of its own because Modal renders nothing
 * while closed: the query and the keyboard cursor live here, so they start
 * empty on every open without a reset step (the old popover cleared them in
 * its opening click handler — a reopened list showing last time's filter, with
 * the field that caused it scrolled out of sight, was the bug that guarded).
 */
function IconPanel({ current, labels, onPick }: IconPanelProps) {
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
  const searchRef = useRef<HTMLInputElement | null>(null);

  const choices = useMemo(() => filterTagIcons(query), [query]);

  // The field is the first thing the panel is for. Done here, on mount, rather
  // than left to Modal's own "first focusable" pass: that pass runs a frame
  // later and steps aside when something inside already has focus.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

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
   * guarded the same way inside Modal.
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
      if (name) onPick(name);
    }
  };

  const ids = useId();
  const gridId = `${ids}-grid`;
  const optionId = (name: string) => `${ids}-${name}`;

  return (
    <div>
      {/* Search (#1701). The set is 146 glyphs since #1700, which is past what
          a flat grid can be scanned for, and the names it would be scanned BY
          are lucide's English ones. The field matches those and the Japanese
          table in tagIconAliases.ts, so 「きん」 reaches Dumbbell and `dumb`
          still does too.
          Sticky so the field and the count stay put while the grid scrolls
          under them inside the Modal's body. The background is the opaque
          panel token, never a translucent one — the glyphs pass behind it. */}
      <div className="sticky top-0 z-10 bg-lumen-bg pb-2">
        <div className="relative">
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
            /* Filtering runs on every change, INCLUDING the ones React raises
               mid-composition — that is what makes a half-typed 「きん」 narrow
               to 「きんとれ」 before the IME commits. Only the keys that would
               commit or navigate are guarded. */
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              // A typed query aims at its best match, so Enter takes it — which
              // is also what makes a single result one Enter away. An emptied
              // field goes back to having no cursor at all.
              setActive(next.trim() ? 0 : null);
            }}
            onKeyDown={onSearchKeyDown}
            className={cn(
              "w-full rounded-lumen-sm border border-lumen-border bg-lumen-bg py-1 pl-7 pr-2 text-[0.8rem] text-lumen-text",
              "placeholder:text-lumen-text-tertiary max-md:min-h-11 max-md:text-base",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            )}
          />
        </div>
        <p
          aria-live="polite"
          className="mt-1 text-[0.75rem] text-lumen-text-tertiary"
        >
          {labels.countLabel.replace("{count}", String(choices.length))}
        </p>
      </div>

      {choices.length === 0 ? (
        <p
          role="status"
          className="px-2 py-4 text-center text-[0.75rem] text-lumen-text-secondary"
        >
          {labels.noMatchLabel}
        </p>
      ) : (
        /* The grid is the search field's listbox (#1701), which is what lets
           `aria-activedescendant` name the cell ↑ ↓ moved to while the caret
           stays in the field. The cells stay real buttons carrying
           role="option": a mouse or a Tab still operates them, and only the
           announced role changes.
           Columns are as many as fit, each at least one button wide (#2051). A
           fixed `grid-cols-8` is `minmax(0, 1fr)` per track, so a narrower box
           would squeeze the tracks under the buttons and let them spill
           sideways (#1289 in small). The track floor follows the button size:
           2rem desktop, 2.75rem under 768px. */
        <div
          id={gridId}
          role="listbox"
          aria-label={labels.iconLabel}
          className={cn(
            "grid justify-items-center gap-1",
            "grid-cols-[repeat(auto-fill,minmax(2rem,1fr))]",
            "max-md:grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))]",
          )}
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
                /* Two different "this one" states, and ARIA has a word for
                   each: aria-selected is where the keyboard cursor is,
                   aria-current is the icon this tag already uses. Collapsing
                   them onto aria-selected would tell a screen reader the
                   cursor is somewhere it is not. */
                aria-selected={isActive}
                aria-current={isCurrent || undefined}
                title={choiceName}
                onClick={() => onPick(choiceName)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lumen-sm text-lumen-text-secondary max-md:h-11 max-md:w-11",
                  "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                  isCurrent && "bg-lumen-accent-subtle text-lumen-accent",
                  // The keyboard cursor. Drawn as a ring rather than the
                  // selected fill so "what Enter takes" stays readable on top
                  // of "what this tag already uses".
                  isActive && "ring-2 ring-lumen-accent",
                )}
              >
                <Choice size={15} aria-hidden />
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => onPick(null)}
        className={cn(
          "mt-2 flex w-full items-center gap-1.5 rounded-lumen-sm px-2 py-1 text-[0.75rem] font-medium text-lumen-text-secondary max-md:min-h-11",
          "transition-colors hover:bg-lumen-hover hover:text-lumen-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
        )}
      >
        <Check size={13} aria-hidden className={current ? "opacity-0" : ""} />
        {labels.clearIconLabel}
      </button>
    </div>
  );
}
