import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Check, ChevronDown, ListFilter, X } from "lucide-react";
import { cn, FOCUS_RING } from "@life-editor/shared";

/*
 * The Notes tag filter (#2059) — a button that opens a tag panel, replacing the
 * chip row #1288 put above the list.
 *
 * WHY A BUTTON + PANEL. The chip row was always on screen, so every tag in the
 * vault took a line of the ~240px sidebar whether or not the user was filtering
 * — and #1288 / #1365 spent most of their effort capping it ("+N") so it would
 * not push the first note off the fold. Behind a button the list costs one row
 * until it is asked for, so the panel shows every tag and needs no cap of its
 * own. #2061 makes the tag-grouped list something you reach through this
 * filter rather than the default, which is the other reason it needs a
 * dedicated, named entry.
 *
 * INLINE, NOT A POPOVER. The panel opens in the sidebar's own flow, directly
 * under the button. The list lives in two containers — the push-in rightSidebar
 * on wide and the MobileDrawer on narrow — and a popover would be an overlay
 * inside an overlay in the second one. An in-flow disclosure behaves the same
 * in both and needs no positioning.
 *
 * WHAT DID NOT CHANGE (the semantics, still decided here — #1288): MULTI-select,
 * OR. The list this filters is GROUPED BY TAG, so "selected" means "show these
 * headings"; two tags selected shows both sections. The untagged bucket is an
 * option like any tag. The selection is the host's and is not persisted.
 *
 * Order is the caller's and never changes as you pick (#1364): the pressed
 * state says what is on, so nothing has to move.
 *
 * Pure presentation (§6.4): copy arrives already translated, lumen-* only.
 */

export interface NoteTagFilterOption {
  id: string;
  /** Already-translated label (§6.4). */
  label: string;
  count: number;
  /** Leading glyph — the tag's own icon, tinted with its colour (#1365). */
  icon?: ReactNode;
}

export interface NoteTagFilterPanelLabels {
  /** The button's visible label ("Filter by tag"). */
  button: string;
  /** The button's accessible name while `count` tags are selected. */
  buttonSelected: (count: number) => string;
  /** Accessible name for the panel of options. */
  panel: string;
  /** Action label for the clear button. */
  clear: string;
}

export interface NoteTagFilterPanelProps {
  options: NoteTagFilterOption[];
  /** Selected option ids. Empty = no filter. */
  value: readonly string[];
  /** Add / remove one id. The host owns the set. */
  onToggle: (id: string) => void;
  /** Drop every selection at once. */
  onClear: () => void;
  /**
   * Right-click on one option (#1677) — the Notes host opens the shared tag
   * menu at the pointer. Undefined on narrow, and the host decides which
   * options have one (the untagged bucket does not).
   */
  onOptionContextMenu?: (id: string, event: MouseEvent) => void;
  labels: NoteTagFilterPanelLabels;
}

export function NoteTagFilterPanel({
  options,
  value,
  onToggle,
  onClear,
  onOptionContextMenu,
  labels,
}: NoteTagFilterPanelProps) {
  /*
   * Open / closed is local and starts closed: it answers "I am choosing tags
   * right now", not a lasting preference. The SELECTION is the host's, so
   * closing the panel keeps the filter on — the count on the button says so.
   */
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selected = useMemo(() => new Set(value), [value]);
  const count = value.length;

  // Esc closes from anywhere in the disclosure and puts the focus back on the
  // button that opened it, so a keyboard user is never left on a control that
  // just disappeared. No IME guard: nothing in here takes text input.
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-1.5" onKeyDown={handleKeyDown}>
      <div className="flex items-center gap-1">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          // The visible badge is a bare number; the name says what it counts.
          aria-label={count > 0 ? labels.buttonSelected(count) : undefined}
          className={cn(
            // #1560's narrow floor, the same `max-md:` contract the chips had:
            // Desktop keeps its mouse size.
            "inline-flex h-7 items-center gap-1.5 rounded-lumen-md border px-2 text-xs transition-colors max-md:min-h-11",
            count > 0
              ? "border-lumen-accent bg-lumen-accent-subtle font-semibold text-lumen-accent"
              : "border-lumen-border bg-lumen-bg text-lumen-text-secondary hover:bg-lumen-hover",
            FOCUS_RING,
          )}
        >
          <ListFilter size={13} aria-hidden />
          <span>{labels.button}</span>
          {count > 0 && (
            <span
              aria-hidden
              className="rounded-lumen-full bg-lumen-accent px-1.5 text-[10.5px] font-semibold tabular-nums text-lumen-on-accent"
            >
              {count}
            </span>
          )}
          <ChevronDown
            size={12}
            aria-hidden
            className={cn("transition-transform", open && "rotate-180")}
          />
        </button>

        {/* Only with something to clear (as the chip row did): an always-
            present control that does nothing most of the time is one more
            thing to read past. Beside the button rather than inside the panel
            so the filter can be dropped without opening it again. */}
        {count > 0 && (
          <button
            type="button"
            onClick={onClear}
            aria-label={labels.clear}
            title={labels.clear}
            className={cn(
              // An icon with no label is the one control here that is also too
              // NARROW to aim at, hence the width floor as well (#1560).
              "inline-flex h-7 items-center justify-center rounded-lumen-md px-1.5 text-lumen-text-tertiary hover:bg-lumen-hover hover:text-lumen-text-secondary max-md:min-h-11 max-md:min-w-11",
              FOCUS_RING,
            )}
          >
            <X size={13} aria-hidden />
          </button>
        )}
      </div>

      {/* Always in the tree, `hidden` while closed, so `aria-controls` points
          at something that exists in both states. */}
      <div
        id={panelId}
        role="group"
        aria-label={labels.panel}
        hidden={!open}
        className="max-h-64 overflow-y-auto rounded-lumen-md border border-lumen-border bg-lumen-bg p-1"
      >
        <ul className="flex flex-col gap-px">
          {options.map((option) => {
            const active = selected.has(option.id);
            return (
              <li key={option.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggle(option.id)}
                  onContextMenu={
                    onOptionContextMenu
                      ? (e) => onOptionContextMenu(option.id, e)
                      : undefined
                  }
                  className={cn(
                    "flex h-8 w-full items-center gap-2 rounded-lumen-md px-2 text-left text-xs transition-colors max-md:min-h-11",
                    active
                      ? "bg-lumen-accent-subtle font-semibold text-lumen-accent"
                      : "text-lumen-text-secondary hover:bg-lumen-hover",
                    FOCUS_RING,
                  )}
                >
                  {/* The check is the second cue next to the fill, so the
                        state does not rest on colour alone. Its box is always
                        drawn so the labels line up whether or not it shows. */}
                  <span
                    aria-hidden
                    className="flex w-3.5 shrink-0 items-center justify-center"
                  >
                    {active && <Check size={13} />}
                  </span>
                  {option.icon != null && (
                    <span aria-hidden="true" className="inline-flex">
                      {option.icon}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {option.label}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 tabular-nums",
                      active ? "text-lumen-accent" : "text-lumen-text-tertiary",
                    )}
                  >
                    {option.count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
