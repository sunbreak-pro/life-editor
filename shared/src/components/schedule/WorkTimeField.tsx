import { useId, type KeyboardEvent } from "react";
import { cn } from "../cn";
import type { EventWorkAnchor } from "../../utils/timerSessions";
import { FIELD, FIELD_LABEL } from "../styleTokens";

/*
 * The logged-time field (#1375, typed since #2407), shared by the event editor
 * and — since #2553 — the todo detail panel.
 *
 * It moved out of EventEditorPane when the todo panel needed the same field:
 * the draft rules below (what counts as a change, which values are refused)
 * are the contract the host's write relies on, and two copies would drift the
 * first time one of them was touched.
 *
 * Supplying the model renders the field; omitting it renders nothing — the
 * same idiom as the reminder / repeat / convert bundles.
 *
 * The field edits the TOTAL, the timer's minutes included, because that is the
 * number the row has always shown. The host turns it into a hand-entered row
 * beside the timer's rows, which are never rewritten. That is also why a total
 * below `timerMinutes` is refused.
 *
 * The panel only reports what was typed. A draft like every other field, it
 * goes out with the save button (#628), and the press still writes nothing
 * while the field holds a value it refuses.
 */
export interface WorkTimeModel {
  /** Already-translated field label — 「実績時間」. */
  label: string;
  /** Hint inside the empty field, or the host's "loading" copy while locked. */
  placeholder: string;
  /** Beside the number — 「分」. */
  unit: string;
  /** Whole minutes logged. Null locks the field: the read has not given it yet. */
  totalMinutes: number | null;
  /** Whole minutes the timer measured — the lowest total the field accepts. */
  timerMinutes: number;
  /** Shown under the field when the total is below `timerMinutes`. */
  belowTimerMessage: string;
  /** Shown under the field when it does not hold a whole number. */
  notWholeMessage: string;
  /** The read failed: why the field is locked. */
  loadFailedMessage?: string;
  /**
   * Fires from the save press. `totalMinutes` is null when the field was
   * emptied. `anchor` is the item as the same press leaves it, so the
   * hand-entered row sits on the day and time being saved, and it also fires
   * with the unchanged total when the press only moves the item.
   */
  onSave: (totalMinutes: number | null, anchor: EventWorkAnchor) => void;
}

/** Field text → what saving it would mean. */
export interface WorkTimeDraft {
  /** The field's text. */
  text: string;
  /** Saving this changes the logged time, or the field holds a refused value. */
  dirty: boolean;
  /** The total to save; null = the field is empty. */
  totalMinutes: number | null;
  /** Which message the field shows, if its value is refused. */
  problem: "notWhole" | "belowTimer" | null;
}

/**
 * NFKC so a number typed with a Japanese IME active ("４５") reads the same as
 * "45". An untouched field is never dirty, and neither is an edit that means
 * what is already stored: emptying a field with no hand-entered part in it
 * leaves the total where it was.
 */
export function readWorkTimeDraft(
  workTime: WorkTimeModel,
  edit: string | undefined,
): WorkTimeDraft {
  const { totalMinutes: stored, timerMinutes } = workTime;
  const seed = stored !== null && stored > 0 ? String(stored) : "";
  const text = edit ?? seed;
  const clean: WorkTimeDraft = {
    text,
    dirty: false,
    totalMinutes: stored,
    problem: null,
  };
  if (stored === null || edit === undefined) return clean;
  const normalized = text.normalize("NFKC").trim();
  if (normalized === "") {
    return { ...clean, dirty: stored !== timerMinutes, totalMinutes: null };
  }
  if (!/^\d+$/.test(normalized)) {
    return { ...clean, dirty: true, problem: "notWhole" };
  }
  const minutes = Number(normalized);
  if (minutes < timerMinutes) {
    return { ...clean, dirty: true, problem: "belowTimer" };
  }
  return { ...clean, dirty: minutes !== stored, totalMinutes: minutes };
}

/**
 * Whether the hand-entered row has to follow a press that only MOVED the item:
 * it would otherwise go on counting toward the day the item left.
 */
export function hasHandEnteredTime(workTime: WorkTimeModel): boolean {
  return (
    workTime.totalMinutes !== null &&
    workTime.totalMinutes > workTime.timerMinutes
  );
}

export interface WorkTimeFieldProps {
  workTime: WorkTimeModel;
  draft: WorkTimeDraft;
  /** The typed text; undefined puts the field back under the stored value. */
  onEdit: (text: string | undefined) => void;
  /** Enter in the field — the host's save, IME-guarded by the host. */
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

/*
 * Shown for an all-day row as well, unlike the reminder — a day-long item can
 * absolutely have been worked on, and the number does not depend on there
 * being a clock time.
 */
export function WorkTimeField({
  workTime,
  draft,
  onEdit,
  onKeyDown,
}: WorkTimeFieldProps) {
  const id = useId();
  const messageId = useId();
  const message =
    draft.problem === "belowTimer"
      ? workTime.belowTimerMessage
      : draft.problem === "notWhole"
        ? workTime.notWholeMessage
        : (workTime.loadFailedMessage ?? null);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={FIELD_LABEL}>
        {workTime.label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={draft.text}
          disabled={workTime.totalMinutes === null}
          placeholder={workTime.placeholder}
          onChange={(e) => onEdit(e.target.value)}
          onBlur={() => {
            // An edit that means what is stored goes back under the live
            // value, so "045", or an emptied field with nothing hand-entered
            // in it, shows the number being held.
            if (!draft.dirty) onEdit(undefined);
          }}
          onKeyDown={onKeyDown}
          aria-invalid={draft.problem !== null}
          aria-describedby={message ? messageId : undefined}
          className={cn(
            FIELD,
            "tabular-nums disabled:cursor-not-allowed disabled:bg-lumen-surface-sunken disabled:text-lumen-text-tertiary max-md:min-h-11",
          )}
        />
        {/* Held in place while empty, so the field does not change width on
            the first digit. The placeholder already names the unit. */}
        <span
          aria-hidden
          className={cn(
            "shrink-0 text-sm text-lumen-text-secondary",
            draft.text === "" && "invisible",
          )}
        >
          {workTime.unit}
        </span>
      </div>
      {message && (
        <p id={messageId} role="alert" className="text-xs text-lumen-danger">
          {message}
        </p>
      )}
    </div>
  );
}
