import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "../cn";
import { FrequencyEditor, type FrequencyEditorGroup } from "./FrequencyEditor";
import type { RoutineNode } from "../../types/routine";

/*
 * RoutineEditorForm (W8 target-IA) — the Routines-tab detail form (MasterDetail
 * right pane). Edits one routine: title / start-end / frequency via the shared
 * <FrequencyEditor> (#185 Step 2 — the same part backs the Event editor's
 * repeat section). Pure presentation (§3.1 / §6.4): every edit is an onPatch
 * callback (no save button — the host persists immediately; a `footer` slot
 * lets it add one if it wants). Title is a commit-on-blur draft (Enter blurs;
 * IME composition respected). lumen-* tokens only (§5).
 */

/** The RoutineNode subset this form edits. */
export type RoutineEditorRoutine = Pick<
  RoutineNode,
  | "id"
  | "title"
  | "startTime"
  | "endTime"
  | "frequencyType"
  | "frequencyDays"
  | "frequencyInterval"
  | "frequencyStartDate"
  | "groupIds"
>;

/** Group entry (id / name / data-driven color) — shape owned by FrequencyEditor. */
export type RoutineEditorGroup = FrequencyEditorGroup;

export interface RoutineEditorFormLabels {
  title: string;
  startTime: string;
  endTime: string;
  frequency: string;
  frequencyDaily: string;
  frequencyWeekdays: string;
  frequencyInterval: string;
  frequencyGroup: string;
  /** "N 日ごと" leading word. */
  intervalEvery: string;
  /** "日ごと" trailing word. */
  intervalDays: string;
  startDate: string;
  groups: string;
  delete: string;
}

export interface RoutineEditorFormProps {
  routine: RoutineEditorRoutine;
  groups: RoutineEditorGroup[];
  onPatch: (id: string, patch: Partial<RoutineEditorRoutine>) => void;
  onDelete: (id: string) => void;
  /** Already-translated weekday labels indexed 0 (Sun) – 6 (Sat) (§6.4). */
  weekdayLabels: string[];
  labels: RoutineEditorFormLabels;
  /** Optional footer slot (e.g. a host-owned save button). */
  footer?: ReactNode;
  className?: string;
}

const FIELD =
  "w-full rounded-lumen-md border border-lumen-border bg-lumen-bg px-2.5 py-2 text-sm text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";
const FIELD_LABEL = "text-xs text-lumen-text-secondary";

function TitleInput({
  routineId,
  initial,
  label,
  onCommit,
}: {
  routineId: string;
  initial: string;
  label: string;
  onCommit: (id: string, title: string) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const commit = () => {
    if (draft !== initial) onCommit(routineId, draft);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      aria-label={label}
      className={FIELD}
    />
  );
}

export function RoutineEditorForm({
  routine,
  groups,
  onPatch,
  onDelete,
  weekdayLabels,
  labels,
  footer,
  className,
}: RoutineEditorFormProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3.5 rounded-md border border-lumen-border bg-lumen-bg-secondary p-4",
        className,
      )}
    >
      {/* Title */}
      <label className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>{labels.title}</span>
        <TitleInput
          key={routine.id}
          routineId={routine.id}
          initial={routine.title}
          label={labels.title}
          onCommit={(id, title) => onPatch(id, { title })}
        />
      </label>

      {/* Start / End */}
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className={FIELD_LABEL}>{labels.startTime}</span>
          <input
            type="time"
            value={routine.startTime ?? ""}
            onChange={(e) => onPatch(routine.id, { startTime: e.target.value })}
            aria-label={labels.startTime}
            className={cn(FIELD, "tabular-nums")}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className={FIELD_LABEL}>{labels.endTime}</span>
          <input
            type="time"
            value={routine.endTime ?? ""}
            onChange={(e) => onPatch(routine.id, { endTime: e.target.value })}
            aria-label={labels.endTime}
            className={cn(FIELD, "tabular-nums")}
          />
        </label>
      </div>

      {/* Frequency (type + type-specific controls) — shared with the Event
          editor's repeat section (#185). */}
      <FrequencyEditor
        value={routine}
        onChange={(patch) => onPatch(routine.id, patch)}
        groups={groups}
        weekdayLabels={weekdayLabels}
        labels={labels}
      />

      {footer}

      {/* Delete */}
      <button
        type="button"
        onClick={() => onDelete(routine.id)}
        className="flex items-center gap-1.5 self-start rounded-sm text-[13px] font-medium text-lumen-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      >
        <Trash2 aria-hidden className="size-3.5" />
        {labels.delete}
      </button>
    </div>
  );
}
