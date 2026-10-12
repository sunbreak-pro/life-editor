import type { KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { cn } from "./cn";
import { FOCUS_RING_TIGHT } from "./styleTokens";

/*
 * The SELECTION checkbox (#2217) — the square one.
 *
 * The app has two kinds of checkbox and they must not look alike:
 *   - completion: a todo being done. Round, and always <TodoStatusCheckbox>.
 *   - selection: picking items for a bulk action or a filter. Square, and
 *     always this file.
 * Before this file the square kind had no shared part: the filter panels and
 * the trash used the browser's own box, and the two goal pickers each drew
 * their own. The browser box follows the platform look (round-ish on some, a
 * native tick on others), which is how a "pick these" box ended up reading
 * like a "done" circle.
 *
 * Two exports, because the square is used in two shapes:
 *   - <SelectCheckbox> is a control on its own: a `role="checkbox"` button that
 *     carries the mark. Use it where the box itself is what gets pressed.
 *   - <SelectCheckboxMark> is only the drawn square, aria-hidden. Use it inside
 *     a row that is ALREADY the `role="checkbox"` control (the goal pickers),
 *     so the row keeps one accessible checkbox rather than two nested ones.
 *
 * Pure presentation (§6.4): the name arrives translated, the state change is
 * the injected onChange, lumen-* tokens only (§5).
 */

export interface SelectCheckboxMarkProps {
  checked: boolean;
  className?: string;
}

/** The drawn square: an outline when off, filled with the accent when on. */
export function SelectCheckboxMark({
  checked,
  className,
}: SelectCheckboxMarkProps) {
  return (
    <span
      aria-hidden
      data-select-checkbox-mark=""
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
        checked
          ? "border-lumen-accent bg-lumen-accent text-lumen-on-accent"
          : "border-lumen-border-strong bg-lumen-bg",
        className,
      )}
    >
      {checked && <Check className="size-3" strokeWidth={3} />}
    </span>
  );
}

export interface SelectCheckboxProps {
  checked: boolean;
  /** The state one press lands on — the host stores it. */
  onChange: (next: boolean) => void;
  /**
   * Already-translated accessible name (§6.4). Omit it only when an enclosing
   * <label> names the control — a button is labelable, so the label's text
   * becomes its name and a click on that text presses it.
   */
  label?: string;
  disabled?: boolean;
  /** Sizing / layout of the pressable box. The mark stays 16px inside it. */
  className?: string;
}

/*
 * Keyboard: Space toggles, as on a native checkbox (WAI-ARIA checkbox
 * pattern). It is handled on keydown and the keyup default is cancelled too:
 * a <button> otherwise turns Space into a click on keyup in every engine, and
 * without both halves one press would toggle twice. Enter is left to the
 * button's own click, which the checkbox pattern tolerates.
 */
export function SelectCheckbox({
  checked,
  onChange,
  label,
  disabled = false,
  className,
}: SelectCheckboxProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key !== " ") return;
    e.preventDefault();
    if (!disabled) onChange(!checked);
  };
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === " ") e.preventDefault();
  };
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      className={cn(
        "flex shrink-0 cursor-pointer items-center justify-center rounded-sm",
        "disabled:cursor-not-allowed disabled:opacity-60",
        FOCUS_RING_TIGHT,
        className,
      )}
    >
      <SelectCheckboxMark checked={checked} />
    </button>
  );
}
