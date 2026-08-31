import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { cn } from "./cn";
import { stepSegmentFocus } from "./segmentedKeyNav";
import { TAP_TARGET_TALL } from "./styleTokens";
import { tourAnchor } from "./tour/anchor";

export interface SegmentedOption {
  id: string;
  /** Already-translated segment label (§6.4). */
  label: string;
  /**
   * `data-tour-id` for the tutorial tour (#1124). Per-segment rather than
   * derived from `id` for the same reason HeaderTabs takes one: the ids here
   * are host-local ("todo" is a Schedule sidebar tab and an Analytics tab),
   * and `resolveTourAnchor` takes the FIRST match in the document, so a
   * derived id would be ambiguous the moment two tracks share a segment name.
   */
  tourId?: string;
}

/**
 * How much vertical room a segment takes (#1039).
 *
 *  - "md" — the original. Every in-panel use (schedule editors, the sidebar
 *    tab pair) keeps it: those sit in their own boxes where 4px changes
 *    nothing, and shrinking the type there would just make them harder to read.
 *    The sidebar tabs do end up a step smaller since #1343, but not for
 *    density — see `singleLineLabels`, where the type is part of what buys
 *    three long labels a single row.
 *  - "sm" — the mobile SECTION tab band, which is a different problem. It runs
 *    the full width at the very top of every narrow screen, so its height is
 *    subtracted from the content on all seven sections at once ("要素を圧迫
 *    している"). One step down on the type and a slightly tighter gutter take
 *    the band from 36px to 32px.
 *
 * The touch target does NOT follow the box down: "sm" carries TAP_TARGET_TALL,
 * which hangs an invisible 44px hit area over the smaller pill. The band
 * therefore ends up EASIER to hit than it was before this size existed (36px),
 * while reading as less furniture.
 */
export type SegmentedControlSize = "md" | "sm";

const SIZE_CLASSES: Record<SegmentedControlSize, string> = {
  md: "px-3 py-1.5 text-sm",
  sm: `px-2.5 py-1.5 text-xs ${TAP_TARGET_TALL}`,
};

/*
 * The same two rows with the horizontal padding and one step of type given
 * back, used only under `singleLineLabels` (#1343).
 *
 * Written as its own table rather than appended to the one above because `cn`
 * is a plain string join: two px-* classes on the same button do not resolve
 * "last one wins", they let Tailwind's emit order decide (the #830 bug class,
 * `.claude/rules/frontend.md` §Gotchas). Exactly one padding class and one
 * type class must reach the element, so the caller picks a whole row.
 *
 * The padding is nearly free here: segments are flex-1, so their width comes
 * from the track and the label is centred inside whatever it gets — px-1.5
 * only lowers the floor a long label is allowed to reach, it does not move a
 * short one. The type step is the part that is actually visible, and it is
 * small (text-xs is lifted to 0.8125rem in tokens.css, so ~14.6px against
 * text-sm's ~15.8px at the default 18px root). Both together are what buy
 * three long labels a single row in a 320px panel.
 */
const SINGLE_LINE_SIZE_CLASSES: Record<SegmentedControlSize, string> = {
  md: "px-1.5 py-1.5 text-xs",
  sm: `px-1.5 py-1.5 text-xs ${TAP_TARGET_TALL}`,
};

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  /** Already-translated accessible name for the tablist (§6.4). */
  label?: string;
  /**
   * Locks every segment while the host is busy applying the last choice
   * (#434). Pointer and keyboard both no-op, and the track reads as busy —
   * a silently-dropped click is what "押しても無反応" looked like.
   *
   * Deliberately NOT the `disabled` attribute: this is a tablist with a
   * roving tabindex, and every segment locks at once. A real `disabled`
   * would strip the whole track of focusable elements, so the browser would
   * dump keyboard focus on <body> mid-interaction and never bring it back.
   * `aria-disabled` + inert handlers keeps the focused segment focused,
   * which is also what the ARIA authoring practices ask for on tabs.
   */
  disabled?: boolean;
  /** Vertical density — see SegmentedControlSize. Default "md". */
  size?: SegmentedControlSize;
  /**
   * Keeps every label on ONE line and lets the TRACK wrap instead (#1343).
   *
   * Most tracks hold a word or two per segment and never meet this. The
   * Schedule detail panel is the exception: three tabs (ja 今日の流れ /
   * 本日の Todo / 繰り返し, en Today's flow / Today's Todo / Repeats) share a
   * 320px panel, which leaves roughly 67px of text room per segment at the
   * default 18px root. The two long ones broke mid-label (「今日の流」+「れ」,
   * "Today's" + "flow") while 繰り返し stayed on one line, so the three tabs
   * stopped looking like one control. #1207 aligned the broken labels; it did
   * not stop them breaking.
   *
   * The answer is the one #1264 already reached for the tour footer: the text
   * is nowrap and the ROW is what gives. CJK offers a break between any two
   * glyphs, so a squeezed flex row will always find one — refusing the break
   * has to come first, and something else then has to absorb the overrun.
   * Here that is flex-wrap on the track: at the panel's 240px minimum, or at
   * the top of the font-size slider, the segments fall into two rows with
   * every label still intact, instead of one row of shredded ones.
   *
   * Not the default. The other four call sites already fit on one line, and
   * FrequencyEditor's en "Every N days" — four segments inside a phone-width
   * sheet — is a label that genuinely should keep wrapping.
   */
  singleLineLabels?: boolean;
  className?: string;
}

/*
 * Mobile-standard segmented control (target-IA — the narrow-width echo of the
 * Desktop HeaderTabs). Recessed track (bg-secondary) with equal-width
 * segments; the active segment lifts onto the base surface with a small
 * elevation. No badges (Mobile drops the count pills). WAI-ARIA tablist with
 * roving tabindex: ←/→ and ↑/↓ move focus + activate (shared
 * stepSegmentFocus — the same keys as its two radiogroup siblings, #779).
 * Pure presentation: labels
 * injected already-translated (§6.4), lumen-* tokens only (§5). Segments carry
 * horizontal padding at both sizes so they stay visually separated even under
 * intrinsic (w-auto) width, where flex-1 no longer pads them apart.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  label,
  disabled = false,
  size = "md",
  singleLineLabels = false,
  className,
}: SegmentedControlProps) {
  const sizeClasses = singleLineLabels
    ? SINGLE_LINE_SIZE_CLASSES[size]
    : SIZE_CLASSES[size];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Keeps the tablist keyboard-reachable when value matches no option:
  // the first segment falls back to tabindex 0 (roving-tabindex invariant).
  const activeIndex = options.findIndex((o) => o.id === value);

  const handleKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (disabled) return;
    const next = stepSegmentFocus(e, index, options, refs);
    if (next) onChange(next.id);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      aria-busy={disabled || undefined}
      className={cn(
        "flex gap-0.5 rounded-lumen-md bg-lumen-bg-secondary p-0.5",
        // What absorbs the overrun once the labels refuse to break: the row
        // splits, not the words (see singleLineLabels). gap-0.5 already
        // spaces both axes, so the second row needs nothing of its own.
        singleLineLabels && "flex-wrap",
        className,
      )}
    >
      {options.map((option, i) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={disabled || undefined}
            tabIndex={active || (activeIndex === -1 && i === 0) ? 0 : -1}
            {...(option.tourId ? tourAnchor(option.tourId) : {})}
            onClick={disabled ? undefined : () => onChange(option.id)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              // A FLEX box, not a plain block (#1207). The track stretches
              // every segment to the tallest one, so as soon as one label
              // wraps, a one-line label sits pinned at the top of its own
              // button while its neighbours fill theirs — the three labels
              // stop sharing a baseline. Centring inside each segment lines
              // them up whatever the line count. Single-line rows are
              // unaffected: the height is still content + padding, and the
              // text was already in the middle of it.
              "flex flex-1 items-center justify-center rounded-lumen-sm text-center",
              singleLineLabels && "whitespace-nowrap",
              sizeClasses,
              "transition-colors focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-lumen-accent",
              disabled && "cursor-not-allowed opacity-60",
              active
                ? "bg-lumen-bg font-medium text-lumen-text shadow-lumen-sm"
                : "text-lumen-text-secondary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
