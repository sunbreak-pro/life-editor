import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { Filter, X } from "lucide-react";
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
 * CHIPS, NOT ROWS (#2578). The panel used to give each tag a full-width row,
 * so a vault with many tags made it tall. Pills that wrap fit several tags on
 * one line, the same shape as the sort panel's chips (#2577) beside it. The
 * per-tag note count went with the rows: the prototype draws none, and the
 * grouped list the filter switches to counts each heading anyway.
 *
 * TWO LAYOUTS. `panel` is the button + disclosure above. `row` is the narrow
 * one: the same chips as an always-visible, sideways-scrolling strip that
 * starts with "All", so a thumb filters without opening anything first. The
 * host picks the layout; this component does not read the viewport.
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
  /** Not drawn since #2578; kept so the host's option shape stays one type. */
  count: number;
  /** Leading glyph — the tag's own icon, tinted with its colour (#1365). */
  icon?: ReactNode;
}

export interface NoteTagFilterPanelLabels {
  /** The button's visible label ("Tags"). */
  button: string;
  /** The button's accessible name while `count` tags are selected. */
  buttonSelected: (count: number) => string;
  /** Accessible name for the group of options. */
  panel: string;
  /** Accessible name of the clear button. */
  clear: string;
  /** The panel's visible heading ("Filter by tag"); none is drawn without it. */
  heading?: string;
  /** The clear button's visible text; falls back to `clear`. */
  clearText?: string;
  /** The `row` layout's leading chip ("All"); it is left out without it. */
  all?: string;
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
  /** `panel` (button + disclosure, the default) or the narrow `row`. */
  layout?: "panel" | "row";
}

export function NoteTagFilterPanel({
  options,
  value,
  onToggle,
  onClear,
  onOptionContextMenu,
  labels,
  layout = "panel",
}: NoteTagFilterPanelProps): ReactElement {
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

  const chips = options.map((option) => (
    <TagChip
      key={option.id}
      pressed={selected.has(option.id)}
      onClick={() => onToggle(option.id)}
      onContextMenu={
        onOptionContextMenu
          ? (e) => onOptionContextMenu(option.id, e)
          : undefined
      }
      icon={option.icon}
    >
      {option.label}
    </TagChip>
  ));

  if (layout === "row") {
    return (
      <div
        role="group"
        aria-label={labels.panel}
        // One line that scrolls sideways rather than wraps: on a phone the
        // strip sits above the list and must not grow with the tag count.
        className="flex gap-1.5 overflow-x-auto pb-0.5"
      >
        {labels.all != null && (
          // "All" is the clear, drawn as the chip that is on while nothing
          // is, so the strip always has exactly one way back.
          <TagChip pressed={count === 0} onClick={onClear}>
            {labels.all}
          </TagChip>
        )}
        {chips}
      </div>
    );
  }

  // Esc closes from anywhere in the disclosure and puts the focus back on the
  // button that opened it, so a keyboard user is never left on a control that
  // just disappeared. No IME guard: nothing in here takes text input.
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-1.5" onKeyDown={handleKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        // The visible badge is a bare number; the name says what it counts.
        aria-label={count > 0 ? labels.buttonSelected(count) : undefined}
        title={labels.heading}
        className={cn(
          // #1560's narrow floor, the same `max-md:` contract the chips had:
          // Desktop keeps its mouse size.
          "inline-flex h-7 items-center gap-1.5 self-start rounded-lumen-md border px-2 text-xs transition-colors max-md:min-h-11",
          count > 0
            ? "border-lumen-accent bg-lumen-accent-subtle font-semibold text-lumen-accent"
            : "border-lumen-border bg-lumen-bg text-lumen-text-secondary hover:bg-lumen-hover",
          FOCUS_RING,
        )}
      >
        <Filter size={13} aria-hidden />
        <span>{labels.button}</span>
        {count > 0 && (
          <span
            aria-hidden
            className="rounded-lumen-full bg-lumen-accent px-1.5 text-[10.5px] font-semibold tabular-nums text-lumen-on-accent"
          >
            {count}
          </span>
        )}
      </button>

      {/* Always in the tree, `hidden` while closed, so `aria-controls` points
          at something that exists in both states. The display class is only
          set while open so it cannot outrank the `hidden` attribute. */}
      <div
        id={panelId}
        role="group"
        aria-label={labels.panel}
        hidden={!open}
        className={cn(
          open && "flex flex-col gap-2",
          "max-h-64 overflow-y-auto rounded-lumen-md border border-lumen-border bg-lumen-bg p-2",
        )}
      >
        {labels.heading != null && (
          <span
            className="text-[11px] font-semibold text-lumen-text-tertiary"
          >
            {labels.heading}
          </span>
        )}
        <div className="flex flex-wrap gap-1.5">{chips}</div>

        {/* Only with something to clear: an always-present control that does
            nothing most of the time is one more thing to read past. */}
        {count > 0 && (
          <button
            type="button"
            onClick={onClear}
            aria-label={labels.clear}
            className={cn(
              "inline-flex h-7 items-center gap-1 self-start rounded-lumen-md px-1.5 text-xs text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
              // The narrow floor in both directions (#1560), on the tap-touch
              // token the icon-only controls share (#2673).
              "max-md:min-h-lumen-tap-touch max-md:min-w-lumen-tap-touch",
              FOCUS_RING,
            )}
          >
            <X size={13} aria-hidden />
            <span>{labels.clearText ?? labels.clear}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function TagChip({
  pressed,
  onClick,
  onContextMenu,
  icon,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  onContextMenu?: (event: MouseEvent) => void;
  icon?: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        "inline-flex h-7 max-w-full shrink-0 items-center gap-1.5 rounded-lumen-full border px-2.5 text-xs transition-colors max-md:min-h-11",
        // The bold weight is the second cue next to the accent border, so the
        // state does not rest on colour alone (as the sort chips, #2577).
        pressed
          ? "border-lumen-accent font-semibold text-lumen-accent"
          : "border-lumen-border text-lumen-text-secondary hover:bg-lumen-hover",
        FOCUS_RING,
      )}
    >
      {icon != null && (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {icon}
        </span>
      )}
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}
