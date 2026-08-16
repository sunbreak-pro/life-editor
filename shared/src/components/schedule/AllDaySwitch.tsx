import { cn } from "../cn";
import { FOCUS_RING_TIGHT } from "../styleTokens";

/*
 * The "all day" switch, shared by the two places a schedule item's time span
 * can be taken away: EventEditorPane (#469, editing an existing row) and
 * ItemCreatePanel (#940, creating one).
 *
 * A `role="switch"` button rather than a checkbox because it reads as one
 * state, not a form value to submit, and because it has to sit on the same
 * baseline as the date field beside it. Both callers place it that way — a
 * `flex items-end` row with the date input taking the remaining width — so the
 * two screens agree on where the control is, not just on what it looks like.
 *
 * Pure presentation: the label arrives already translated (§6.4) and the
 * checked state lives in the caller's draft.
 */
export interface AllDaySwitchProps {
  checked: boolean;
  onToggle: () => void;
  /** Already-translated label, and the switch's accessible name. */
  label: string;
}

export function AllDaySwitch({ checked, onToggle, label }: AllDaySwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-lumen-md border px-2.5 py-2 text-sm font-medium transition-colors",
        FOCUS_RING_TIGHT,
        checked
          ? "border-lumen-accent bg-lumen-accent-subtle text-lumen-accent"
          : "border-lumen-border-strong text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
      )}
    >
      {label}
    </button>
  );
}
