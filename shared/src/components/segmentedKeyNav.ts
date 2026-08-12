import type { KeyboardEvent } from "react";

/**
 * Shared roving-tabindex step for the segmented primitives (C8 dedup).
 * SegmentedControl (tablist), SegmentedToggle and SettingsSegment (both
 * radiogroups) keep their deliberately different ARIA roles — only the
 * identical keyboard walk is consolidated.
 *
 * Both axes step the same way: ArrowRight / ArrowDown go forward,
 * ArrowLeft / ArrowUp go backward, wrapping past either end (#779). ↑/↓ are
 * in because two of the three callers are radiogroups, where the WAI-ARIA
 * authoring practices require them; the tablist takes them too so all three
 * answer the same keys. Every strip is a single row, so no caller needs an
 * orientation switch.
 *
 * Returns the option to activate, or null when the event is not an arrow key
 * (caller then leaves the event alone).
 */
export function stepSegmentFocus<O extends object>(
  e: KeyboardEvent<HTMLButtonElement>,
  index: number,
  options: readonly O[],
  refs: { current: (HTMLButtonElement | null)[] },
): O | null {
  const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
  const backward = e.key === "ArrowLeft" || e.key === "ArrowUp";
  if (!forward && !backward) return null;
  e.preventDefault();
  if (options.length === 0) return null;
  const dir = forward ? 1 : -1;
  const next = (index + dir + options.length) % options.length;
  const nextOption = options[next];
  if (!nextOption) return null;
  refs.current[next]?.focus();
  return nextOption;
}
