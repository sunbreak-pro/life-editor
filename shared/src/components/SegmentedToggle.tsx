import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { cn } from "./cn";

export interface SegmentedToggleOption<T extends string> {
  value: T;
  /** Already-translated segment label (§6.4). */
  label: string;
}

export interface SegmentedToggleProps<T extends string> {
  options: readonly SegmentedToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Already-translated accessible name for the radiogroup (§6.4). */
  label: string;
  disabled?: boolean;
  className?: string;
}

/*
 * Mutually-exclusive mode / filter toggle (Auth "ログイン / 新規登録" first;
 * reusable for other screens' filters). Distinct from the shell-owned
 * SegmentedControl: that one is the Mobile echo of HeaderTabs (tablist
 * semantics — it switches *views*), while this one switches a *form's mode*
 * (radiogroup semantics, accent-subtle fill + accent border on the active
 * segment per the Auth design). Segments are touch-first (44px) and compact
 * from md up (32px). Roving tabindex: ←/→ move focus + select. Pure
 * presentation: labels injected already-translated (§6.4), lumen-* tokens
 * only (§5).
 */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled = false,
  className,
}: SegmentedToggleProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Keeps the group keyboard-reachable when value matches no option: the
  // first segment falls back to tabindex 0 (roving-tabindex invariant).
  const activeIndex = options.findIndex((o) => o.value === value);

  const handleKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    if (options.length === 0) return;
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = (index + dir + options.length) % options.length;
    const nextOption = options[next];
    if (!nextOption) return;
    refs.current[next]?.focus();
    onChange(nextOption.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex gap-0.5 rounded-lumen-md bg-lumen-surface-sunken p-0.5",
        className,
      )}
    >
      {options.map((option, i) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            tabIndex={active || (activeIndex === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "h-11 flex-1 rounded-lumen-sm border text-center text-sm",
              "transition-colors focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-lumen-accent disabled:cursor-not-allowed md:h-8",
              active
                ? "border-lumen-accent bg-lumen-accent-subtle font-medium text-lumen-text"
                : "border-transparent text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
