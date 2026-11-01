import type { KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { cn } from "../cn";
import { FOCUS_RING_TIGHT } from "../styleTokens";

/*
 * The "all day" round check of the creation panel (#2406).
 *
 * The Claude Design proposal puts the day, the two times and "all day" on one
 * line, and draws "all day" as a round check — the round kind of #2217's
 * "round marks a state, square picks things" split. A state is what this is:
 * it says what the item IS, not which items a bulk action will take.
 *
 * Deliberately a part of its own rather than a variant of <AllDaySwitch>: the
 * editing side (EventEditorPane) keeps its switch until #2407 brings the edit
 * panel to the proposal, and one part with two looks would make that change
 * reach both screens at once.
 *
 * A `role="checkbox"` button carrying a visible label, so the label is both
 * the accessible name and part of the target. Space toggles on keydown with
 * the keyup default cancelled, as <SelectCheckbox> does — a <button> would
 * otherwise turn the same Space into a second click on keyup.
 *
 * Pure presentation (§6.4): the label arrives already translated and the
 * checked state lives in the caller's draft. lumen-* tokens only (§5).
 */
export interface AllDayCheckProps {
  checked: boolean;
  onToggle: () => void;
  /** Already-translated label, and the check's accessible name. */
  label: string;
}

export function AllDayCheck({
  checked,
  onToggle,
  label,
}: AllDayCheckProps): React.JSX.Element {
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key !== " ") return;
    e.preventDefault();
    onToggle();
  };
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === " ") e.preventDefault();
  };
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      data-all-day-check=""
      className={cn(
        // `py-2` lines the box up with the FIELD inputs beside it; on a phone
        // the 44px floor takes over (rules/frontend.md §Gotchas).
        "flex shrink-0 items-center gap-1.5 rounded-lumen-md px-1.5 py-2 text-sm text-lumen-text transition-colors hover:bg-lumen-hover max-md:min-h-11",
        FOCUS_RING_TIGHT,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          checked
            ? "border-lumen-accent bg-lumen-accent text-lumen-on-accent"
            : "border-lumen-border-strong bg-lumen-bg",
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}
