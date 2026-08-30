import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { cn } from "./cn";
import { stepSegmentFocus } from "./segmentedKeyNav";

export interface SettingsSegmentOption<V extends string> {
  value: V;
  label: string;
}

export interface SettingsSegmentProps<V extends string> {
  /** Group label (already translated). */
  label: string;
  /** Optional caption under the label. */
  description?: string;
  /**
   * Drop the VISIBLE copy of the label, keeping it only as the radiogroup's
   * accessible name. For hosts that already print that name themselves — the
   * font-size row pairs it with a live px readout, so rendering it here too
   * stacked the same words twice (#1253). A description, if given, still
   * shows: it is the host's caption, not a second copy of the name.
   */
  hideLabel?: boolean;
  value: V;
  onChange: (value: V) => void;
  options: SettingsSegmentOption<V>[];
}

/*
 * Labeled inline segmented control (§216 settings). A small radiogroup of
 * equal-width pill buttons — the settings analogue of the shell's
 * SegmentedControl, but with a group label/description and generic string
 * value. Pure / props-injected (CLAUDE.md §6.4): lumen-* tokens only, opaque
 * surfaces (§5), no i18n inside (host injects translated copy). Selection =
 * accent border + tinted surface; the whole strip is one radiogroup with
 * roving tabindex + ←/→ / ↑/↓ to move + select — the shared stepSegmentFocus
 * walk, so this really does answer the same keys as the shell's
 * SegmentedControl (#779: it used to hand-roll the same loop).
 */
export function SettingsSegment<V extends string>({
  label,
  description,
  hideLabel = false,
  value,
  onChange,
  options,
}: SettingsSegmentProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // When value matches no option, keep the group keyboard-reachable by making
  // the first radio the tab-stop (roving-tabindex invariant).
  const selectedIndex = options.findIndex((o) => o.value === value);

  const handleKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const next = stepSegmentFocus(e, index, options, refs);
    if (next) onChange(next.value);
  };

  return (
    <div className="flex flex-col gap-2">
      {(!hideLabel || description) && (
        <div className="flex flex-col gap-0.5">
          {!hideLabel && (
            <span className="text-sm font-medium text-lumen-text">{label}</span>
          )}
          {description && (
            <span className="text-sm text-lumen-text-secondary">
              {description}
            </span>
          )}
        </div>
      )}
      <div
        role="radiogroup"
        aria-label={label}
        className="grid auto-cols-fr grid-flow-col gap-2"
      >
        {options.map((option, i) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (selectedIndex === -1 && i === 0) ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={cn(
                "flex h-10 items-center justify-center rounded-lumen-md px-3 text-sm",
                "transition-colors focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-lumen-accent",
                selected
                  ? "border-2 border-lumen-accent bg-lumen-accent-subtle font-medium text-lumen-text"
                  : "border border-lumen-border bg-lumen-bg text-lumen-text-secondary hover:border-lumen-border-strong",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
