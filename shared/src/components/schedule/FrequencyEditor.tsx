import { cn } from "../cn";
import { SegmentedControl } from "../SegmentedControl";
import type { FrequencyType, RoutineNode } from "../../types/routine";

/*
 * FrequencyEditor (#185 Step 2) — the repeat-settings editor shared between the
 * Routines-tab form (RoutineEditorForm) and the Event editor's repeat section.
 * Edits one routine's frequency: type (daily | weekdays | interval | group)
 * plus the type-specific controls (weekday chips / interval + start-date /
 * group chips). Pure presentation (§3.1 / §6.4): every edit is an onChange
 * patch; labels arrive already translated. lumen-* tokens only (§5).
 *
 * Event-side differences ride two props: `onSelectNone` prepends a "no repeat"
 * choice (value null = none active), and `allowGroup: false` stops "group"
 * from being newly chosen there (#185 — group routines stay editable in the
 * Routines tab; an existing group value still renders so the control always
 * reflects reality).
 */

/** The RoutineNode frequency subset this editor owns. */
export type FrequencyEditorValue = Pick<
  RoutineNode,
  | "frequencyType"
  | "frequencyDays"
  | "frequencyInterval"
  | "frequencyStartDate"
  | "groupIds"
>;

export interface FrequencyEditorGroup {
  id: string;
  name: string;
  /** Data-driven group color (applied via inline style, not a token). */
  color: string;
}

export interface FrequencyEditorLabels {
  frequency: string;
  frequencyDaily: string;
  frequencyWeekdays: string;
  frequencyInterval: string;
  frequencyGroup: string;
  /** "No repeat" choice; required when the host passes onSelectNone. */
  frequencyNone?: string;
  /** "N 日ごと" leading word. */
  intervalEvery: string;
  /** "日ごと" trailing word. */
  intervalDays: string;
  startDate: string;
  groups: string;
}

export interface FrequencyEditorProps {
  /** Current frequency; null = no repeat (only when onSelectNone is given). */
  value: FrequencyEditorValue | null;
  onChange: (patch: Partial<FrequencyEditorValue>) => void;
  /** When provided, a "no repeat" choice is offered first; selecting it calls
   *  this instead of onChange. Pair with labels.frequencyNone. */
  onSelectNone?: () => void;
  /** Offer "group" as a choosable type. Defaults to true (Routines tab). */
  allowGroup?: boolean;
  /** Needed only when the group type is reachable. */
  groups?: FrequencyEditorGroup[];
  /** Already-translated weekday labels indexed 0 (Sun) – 6 (Sat) (§6.4). */
  weekdayLabels: string[];
  labels: FrequencyEditorLabels;
  className?: string;
}

const FIELD =
  "w-full rounded-lumen-md border border-lumen-border bg-lumen-bg px-2.5 py-2 text-sm text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";
const FIELD_LABEL = "text-xs text-lumen-text-secondary";
const CHIP_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

/** Sentinel id for the "no repeat" segment (not a FrequencyType). */
const NONE_ID = "none";

export function FrequencyEditor({
  value,
  onChange,
  onSelectNone,
  allowGroup = true,
  groups = [],
  weekdayLabels,
  labels,
  className,
}: FrequencyEditorProps) {
  const freqOptions = [
    ...(onSelectNone
      ? [{ id: NONE_ID, label: labels.frequencyNone ?? "" }]
      : []),
    { id: "daily", label: labels.frequencyDaily },
    { id: "weekdays", label: labels.frequencyWeekdays },
    { id: "interval", label: labels.frequencyInterval },
    // Group stays listed while it IS the current value even when not newly
    // choosable, so the control never shows a state it cannot represent.
    ...(allowGroup || value?.frequencyType === "group"
      ? [{ id: "group", label: labels.frequencyGroup }]
      : []),
  ];

  const handleSelect = (id: string) => {
    if (id === NONE_ID) onSelectNone?.();
    else onChange({ frequencyType: id as FrequencyType });
  };

  const toggleDay = (d: number) => {
    if (!value) return;
    const has = value.frequencyDays.includes(d);
    const next = has
      ? value.frequencyDays.filter((x) => x !== d)
      : [...value.frequencyDays, d].sort((a, b) => a - b);
    onChange({ frequencyDays: next });
  };

  const toggleGroup = (gid: string) => {
    const cur = value?.groupIds ?? [];
    const next = cur.includes(gid)
      ? cur.filter((x) => x !== gid)
      : [...cur, gid];
    onChange({ groupIds: next });
  };

  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      {/* Frequency type */}
      <div className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>{labels.frequency}</span>
        <SegmentedControl
          options={freqOptions}
          value={value?.frequencyType ?? NONE_ID}
          onChange={handleSelect}
          label={labels.frequency}
        />
      </div>

      {/* Weekday chips */}
      {value?.frequencyType === "weekdays" && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 7 }, (_, d) => {
            const active = value.frequencyDays.includes(d);
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
      {value?.frequencyType === "interval" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-lumen-text">
            <span>{labels.intervalEvery}</span>
            <input
              type="number"
              min={1}
              value={value.frequencyInterval ?? 1}
              onChange={(e) =>
                onChange({
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
              value={value.frequencyStartDate ?? ""}
              onChange={(e) => onChange({ frequencyStartDate: e.target.value })}
              aria-label={labels.startDate}
              className={cn(FIELD, "tabular-nums")}
            />
          </label>
        </div>
      )}

      {/* Group memberships */}
      {value?.frequencyType === "group" && (
        <div className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL}>{labels.groups}</span>
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => {
              const active = (value.groupIds ?? []).includes(g.id);
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
    </div>
  );
}
