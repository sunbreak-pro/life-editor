import type { KeyboardEvent } from "react";

/**
 * Shared ←/→ roving-tabindex step for the segmented primitives (C8 dedup).
 * SegmentedControl (tablist) and SegmentedToggle (radiogroup) keep their
 * deliberately different ARIA roles — only the identical keyboard walk is
 * consolidated. Returns the option to activate, or null when the event is
 * not an arrow key (caller then leaves the event alone).
 */
export function stepSegmentFocus<O>(
  e: KeyboardEvent<HTMLButtonElement>,
  index: number,
  options: readonly O[],
  refs: { current: (HTMLButtonElement | null)[] },
): O | null {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return null;
  e.preventDefault();
  if (options.length === 0) return null;
  const dir = e.key === "ArrowRight" ? 1 : -1;
  const next = (index + dir + options.length) % options.length;
  const nextOption = options[next];
  if (!nextOption) return null;
  refs.current[next]?.focus();
  return nextOption;
}
