import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "../cn";
import { SegmentedControl } from "../SegmentedControl";
import type { FrequencyType, RoutineNode } from "../../types/routine";

/*
 * RoutineEditorForm (W8 target-IA) — the Routines-tab detail form (MasterDetail
 * right pane). Edits one routine: title / start-end / frequency (daily |
 * weekdays | interval | group) with the type-specific controls (weekday chips /
 * interval + start-date / group chips). Pure presentation (§3.1 / §6.4): every
 * edit is an onPatch callback (no save button — the host persists immediately;
 * a `footer` slot lets it add one if it wants). Title is a commit-on-blur draft
 * (Enter blurs; IME composition respected). lumen-* tokens only (§5).
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

export interface RoutineEditorGroup {
  id: string;
  name: string;
  /** Data-driven group color (applied via inline style, not a token). */
  color: string;
}

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
const CHIP_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

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
  const freqOptions = [
    { id: "daily", label: labels.frequencyDaily },
    { id: "weekdays", label: labels.frequencyWeekdays },
    { id: "interval", label: labels.frequencyInterval },
    { id: "group", label: labels.frequencyGroup },
  ];

  const toggleDay = (d: number) => {
    const has = routine.frequencyDays.includes(d);
    const next = has
      ? routine.frequencyDays.filter((x) => x !== d)
      : [...routine.frequencyDays, d].sort((a, b) => a - b);
    onPatch(routine.id, { frequencyDays: next });
  };

  const toggleGroup = (gid: string) => {
    const cur = routine.groupIds ?? [];
    const next = cur.includes(gid)
      ? cur.filter((x) => x !== gid)
      : [...cur, gid];
    onPatch(routine.id, { groupIds: next });
  };

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

      {/* Frequency type */}
      <div className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>{labels.frequency}</span>
        <SegmentedControl
          options={freqOptions}
          value={routine.frequencyType}
          onChange={(id) =>
            onPatch(routine.id, { frequencyType: id as FrequencyType })
          }
          label={labels.frequency}
        />
      </div>

      {/* Weekday chips */}
      {routine.frequencyType === "weekdays" && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 7 }, (_, d) => {
            const active = routine.frequencyDays.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={active}
                aria-label={weekdayLabels[d] ?? String(d)}
                onClick={() => toggleDay(d)}
                className={cn(
                  "flex size-[34px] items-center justify-center rounded-full border text-xs font-medium transition-colors",
                  CHIP_FOCUS,
                  active
                    ? "border-lumen-accent bg-lumen-accent text-lumen-on-accent"
                    : "border-lumen-border-strong text-lumen-text-secondary hover:bg-lumen-hover",
                )}
              >
                {weekdayLabels[d] ?? ""}
              </button>
            );
          })}
        </div>
      )}

      {/* Interval */}
      {routine.frequencyType === "interval" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-lumen-text">
            <span>{labels.intervalEvery}</span>
            <input
              type="number"
              min={1}
              value={routine.frequencyInterval ?? 1}
              onChange={(e) =>
                onPatch(routine.id, {
                  frequencyInterval: Math.max(1, Number(e.target.value) || 1),
                })
              }
              aria-label={labels.frequencyInterval}
              className={cn(FIELD, "w-20 tabular-nums")}
            />
            <span>{labels.intervalDays}</span>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>{labels.startDate}</span>
            <input
              type="date"
              value={routine.frequencyStartDate ?? ""}
              onChange={(e) =>
                onPatch(routine.id, { frequencyStartDate: e.target.value })
              }
              aria-label={labels.startDate}
              className={cn(FIELD, "tabular-nums")}
            />
          </label>
        </div>
      )}

      {/* Group memberships */}
      {routine.frequencyType === "group" && (
        <div className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>{labels.groups}</span>
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => {
              const active = (routine.groupIds ?? []).includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleGroup(g.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    CHIP_FOCUS,
                    active
                      ? "border-lumen-accent bg-lumen-accent-subtle text-lumen-text"
                      : "border-lumen-border-strong text-lumen-text-secondary hover:bg-lumen-hover",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ backgroundColor: g.color }}
                  />
                  {g.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
