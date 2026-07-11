import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { UnfoldHorizontal, FoldHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "./cn";
import type { PageWidthMode } from "../sections";

export interface PageWidthToggleLabels {
  /** Already-translated accessible name for the radiogroup (§6.4). */
  group: string;
  /** Already-translated "wide" segment label（広い）. */
  wide: string;
  /** Already-translated "narrow" segment label（狭い）. */
  narrow: string;
}

export interface PageWidthToggleProps {
  value: PageWidthMode;
  onChange: (mode: PageWidthMode) => void;
  labels: PageWidthToggleLabels;
  className?: string;
}

/*
 * PageWidthToggle — the header width tab (Layout Standard v2 §5). Two fixed
 * segments, each icon + label: wide（広い）= full width / narrow（狭い）=
 * centered reading column. Sits directly LEFT of the RightSidebarToggle at
 * the right end of every SectionHeader; the choice is persisted per section
 * by the host (usePageWidthPrefs).
 *
 * Semantics follow SegmentedToggle (radiogroup + roving tabindex — it picks
 * a page MODE, not a view), but sized for the header row (compact h-7,
 * intrinsic width) where SegmentedToggle's touch-first flex-1 segments are a
 * form control. Pure presentation: copy injected already-translated (§6.4),
 * lumen-* tokens only (§5).
 */
const OPTIONS: readonly { value: PageWidthMode; icon: LucideIcon }[] = [
  { value: "wide", icon: UnfoldHorizontal },
  { value: "narrow", icon: FoldHorizontal },
];

export function PageWidthToggle({
  value,
  onChange,
  labels,
  className,
}: PageWidthToggleProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Keeps the group keyboard-reachable when value matches no option: the
  // first segment falls back to tabindex 0 (roving-tabindex invariant).
  const activeIndex = OPTIONS.findIndex((o) => o.value === value);

  const handleKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = (index + dir + OPTIONS.length) % OPTIONS.length;
    const nextOption = OPTIONS[next];
    if (!nextOption) return;
    refs.current[next]?.focus();
    onChange(nextOption.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={labels.group}
      className={cn(
        "flex gap-0.5 rounded-lumen-md bg-lumen-surface-sunken p-0.5",
        className,
      )}
    >
      {OPTIONS.map((option, i) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (activeIndex === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "flex h-7 items-center gap-1 rounded-lumen-sm border px-2 text-xs",
              "transition-colors focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-lumen-accent",
              active
                ? "border-lumen-accent bg-lumen-accent-subtle font-medium text-lumen-text"
                : "border-transparent text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
            )}
          >
            <Icon size={14} aria-hidden />
            <span>{labels[option.value]}</span>
          </button>
        );
      })}
    </div>
  );
}
