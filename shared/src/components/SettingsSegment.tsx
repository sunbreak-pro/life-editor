import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { cn } from "./cn";

export interface SettingsSegmentOption<V extends string> {
  value: V;
  label: string;
}

export interface SettingsSegmentProps<V extends string> {
  /** Group label (already translated). */
  label: string;
  /** Optional caption under the label. */
  description?: string;
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
 * roving tabindex + ←/→ (and ↑/↓) to move + select — matching the shell's
 * SegmentedControl a11y bar.
 */
export function SettingsSegment<V extends string>({
  label,
  description,
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
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
    const backward = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!forward && !backward) return;
    e.preventDefault();
    if (options.length === 0) return;
    const dir = forward ? 1 : -1;
    const next = (index + dir + options.length) % options.length;
    const nextOption = options[next];
    if (!nextOption) return;
    refs.current[next]?.focus();
    onChange(nextOption.value);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-lumen-text">{label}</span>
        {description && (
          <span className="text-sm text-lumen-text-secondary">
            {description}
          </span>
        )}
      </div>
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
