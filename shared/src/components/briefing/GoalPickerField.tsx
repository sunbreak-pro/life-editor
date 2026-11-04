import { useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Goal, GoalPeriodKind } from "../../types/goal";
import {
  judgeGoals,
  type GoalAchievementTodo,
} from "../../utils/goalAchievement";
import { cn } from "../cn";
import { SelectCheckboxMark } from "../SelectCheckbox";
import { FIELD_LABEL, FOCUS_RING_TIGHT } from "../styleTokens";
import {
  applyGoalLinkEdit,
  goalProgressOf,
  previewGoalLinkEdit,
  type GoalLinkState,
} from "./goalLinkPreview";
import {
  GOAL_CHIP_ACHIEVED,
  GoalAchievementLostNotice,
  GoalProgressDelta,
  goalProgressText,
  type GoalProgressLabels,
} from "./GoalProgressDelta";

/*
 * The goal field of a todo (#2109, plan Step 10 / design L3 + L4) — "which
 * goals does this todo serve", picked from the todo's side.
 *
 * The design drew a stand-alone "edit Todo" screen for this; the plan moved
 * the field into the two places a todo is already edited (the deviation table
 * in the plan): the Schedule detail panel (TodoDetailPanel's goals slot) and
 * the create panel (ItemCreatePanel's todo tab). One field, two hosts — the
 * same split the note and tag rows already have.
 *
 * Controlled and pure (§6.4): the host owns the selection, the save and the
 * data; this only shows the goals and, before anything is saved, the numbers
 * that will move (「企画書を通す 2/4 → 2/5」, 達成が外れます) — computed by
 * the same `judgeGoals` everything else uses (goalLinkPreview.ts).
 *
 * Rows are checkboxes rather than a select: a todo can serve several goals
 * at once (§1.2), and the rows have to say each goal's progress anyway.
 *
 * With `chips` (#2401, the todo detail) the picks read as one chip each, with
 * an × to take it off, and the rows stay folded behind "+ Link to a goal". What
 * the choice is about to do (the numbers, the lost achievement, a failed save)
 * stays outside the fold, since a × can change it with the rows closed.
 */

export interface GoalPickerLabels extends GoalProgressLabels {
  /** Accessible name of the whole list. */
  listLabel: string;
  /** Group headings: 今週 / 今月 / 今年. */
  periods: Readonly<Record<GoalPeriodKind, string>>;
  /** 「保存すると変わる数字」 */
  previewHeading: string;
  /** 「達成が外れました」— the S1 / S2 chip. */
  achievementLost: string;
  /** Shown when the host's last save of the links failed. */
  saveFailed: string;
}

/** The catalog keys the builder below reads, typed so the host's `t` checks. */
export type GoalPickerLabelKey =
  | "goalLink.listLabel"
  | "goalLink.periodWeek"
  | "goalLink.periodMonth"
  | "goalLink.periodYear"
  | "goalLink.unconnected"
  | "goalLink.achieved"
  | "goalLink.becomesAchieved"
  | "goalLink.losesAchievement"
  | "goalLink.achievementLost"
  | "goalLink.previewHeading"
  | "goalLink.saveFailed";

/**
 * The field's copy, built from the host's translate function — one builder
 * for both hosts (the todo detail and the create panel). Still props-only
 * (§6.4): the host resolves the keys; this file only names them.
 */
export function goalPickerLabels(
  translate: (key: GoalPickerLabelKey) => string,
): GoalPickerLabels {
  return {
    listLabel: translate("goalLink.listLabel"),
    periods: {
      week: translate("goalLink.periodWeek"),
      month: translate("goalLink.periodMonth"),
      year: translate("goalLink.periodYear"),
    },
    unconnected: translate("goalLink.unconnected"),
    achieved: translate("goalLink.achieved"),
    becomesAchieved: translate("goalLink.becomesAchieved"),
    losesAchievement: translate("goalLink.losesAchievement"),
    achievementLost: translate("goalLink.achievementLost"),
    previewHeading: translate("goalLink.previewHeading"),
    saveFailed: translate("goalLink.saveFailed"),
  };
}

/** The words of the chip form. Given, the field draws chips over a fold. */
export interface GoalPickerChipLabels {
  /** The button that opens the rows, after a plus. */
  add: string;
  /** "Week · Get the proposal approved". */
  formatChip: (kind: GoalPeriodKind, title: string) => string;
  /** The ×'s spoken name. */
  formatRemove: (title: string) => string;
}

export interface GoalPickerFieldProps {
  /** The goals on offer, in display order (see goalsForTodoPicker). */
  goals: readonly Goal[];
  /** Every live goal, link and todo the achievement rule needs. */
  snapshot: GoalLinkState;
  /** The todo being edited — or the one about to be created. */
  todo: GoalAchievementTodo;
  /** Goals the todo is linked to now (what a save is compared against). */
  baselineIds: readonly string[];
  selectedIds: readonly string[];
  onChange: (ids: string[]) => void;
  /** Titles whose achievement the last operation here took away. */
  lostTitles?: readonly string[];
  failed?: boolean;
  labels: GoalPickerLabels;
  chips?: GoalPickerChipLabels;
}

export function GoalPickerField({
  goals,
  snapshot,
  todo,
  baselineIds,
  selectedIds,
  onChange,
  lostTitles = [],
  failed = false,
  labels,
  chips,
}: GoalPickerFieldProps): React.JSX.Element {
  const [rowsOpen, setRowsOpen] = useState(false);
  const addRef = useRef<HTMLButtonElement | null>(null);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const { current, changes } = useMemo(() => {
    const withTodo = applyGoalLinkEdit(snapshot, { todos: [todo] });
    const base = new Set(baselineIds);
    return {
      current: judgeGoals(withTodo),
      changes: previewGoalLinkEdit(withTodo, {
        link: selectedIds
          .filter((id) => !base.has(id))
          .map((goalId) => ({ goalId, todoId: todo.id })),
        unlink: baselineIds
          .filter((id) => !selected.has(id))
          .map((goalId) => ({ goalId, todoId: todo.id })),
      }),
    };
  }, [snapshot, todo, baselineIds, selectedIds, selected]);
  const titleOf = (id: string): string =>
    snapshot.goals.find((g) => g.id === id)?.title ?? "";

  const groups: Array<{ kind: GoalPeriodKind; goals: Goal[] }> = [];
  for (const goal of goals) {
    const last = groups[groups.length - 1];
    if (last && last.kind === goal.periodKind) last.goals.push(goal);
    else groups.push({ kind: goal.periodKind, goals: [goal] });
  }

  const toggle = (id: string): void => {
    onChange(
      selected.has(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <GoalAchievementLostNotice
        label={labels.achievementLost}
        titles={lostTitles}
      />
      {chips && (
        <div className="flex flex-wrap items-center gap-1.5">
          {goals
            .filter((goal) => selected.has(goal.id))
            .map((goal) => (
              <span
                key={goal.id}
                data-goal-chip={goal.id}
                className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-lumen-md border border-lumen-border bg-lumen-bg px-2 py-0.5 text-xs text-lumen-text"
              >
                <span className="min-w-0 truncate">
                  {chips.formatChip(goal.periodKind, goal.title)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    toggle(goal.id);
                    // The × leaves with its chip; the focus stays in the field.
                    addRef.current?.focus();
                  }}
                  aria-label={chips.formatRemove(goal.title)}
                  className={cn(
                    "shrink-0 rounded-lumen-sm text-lumen-text-secondary hover:text-lumen-danger max-md:-my-3 max-md:-mr-2 max-md:inline-flex max-md:min-h-11 max-md:min-w-11 max-md:items-center max-md:justify-center",
                    FOCUS_RING_TIGHT,
                  )}
                >
                  <X size={14} aria-hidden />
                </button>
              </span>
            ))}
          <button
            ref={addRef}
            type="button"
            onClick={() => setRowsOpen((open) => !open)}
            aria-expanded={rowsOpen}
            className={cn(
              "inline-flex items-center gap-1 rounded-lumen-md border border-dashed border-lumen-border px-2 py-1 text-xs text-lumen-text-secondary transition-colors hover:bg-lumen-hover max-md:min-h-11",
              FOCUS_RING_TIGHT,
            )}
          >
            <Plus size={14} aria-hidden />
            {chips.add}
          </button>
        </div>
      )}
      {(!chips || rowsOpen) && (
        <div aria-label={labels.listLabel} role="group" className="space-y-2">
          {groups.map((group) => (
            <div
              key={group.kind}
              role="group"
              aria-label={labels.periods[group.kind]}
            >
              <p className={cn(FIELD_LABEL, "mb-1")}>
                {labels.periods[group.kind]}
              </p>
              <ul className="space-y-1">
                {group.goals.map((goal) => {
                  const judged = current[goal.id];
                  const progress = judged ? goalProgressOf(judged) : null;
                  const checked = selected.has(goal.id);
                  return (
                    <li key={goal.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggle(goal.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lumen-md border px-2 py-1.5 text-left text-sm transition-colors max-md:min-h-11",
                          checked
                            ? "border-lumen-accent bg-lumen-accent-subtle text-lumen-text"
                            : "border-lumen-border bg-lumen-bg text-lumen-text hover:bg-lumen-hover",
                          FOCUS_RING_TIGHT,
                        )}
                      >
                        <SelectCheckboxMark checked={checked} />
                        <span className="min-w-0 flex-1 truncate">
                          {goal.title}
                        </span>
                        {progress?.achieved ? (
                          <span className={GOAL_CHIP_ACHIEVED}>
                            {labels.achieved}
                          </span>
                        ) : (
                          progress && (
                            <span className="shrink-0 text-xs tabular-nums text-lumen-text-tertiary">
                              {goalProgressText(progress, labels)}
                            </span>
                          )
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
      {changes.length > 0 && (
        <div className="rounded-lumen-md border border-lumen-border bg-lumen-bg px-2.5 py-2">
          <p className={cn(FIELD_LABEL, "mb-1")}>{labels.previewHeading}</p>
          <ul className="space-y-1">
            {changes.map((c) => (
              <GoalProgressDelta
                key={c.goalId}
                title={titleOf(c.goalId)}
                before={c.before}
                after={c.after}
                labels={labels}
              />
            ))}
          </ul>
        </div>
      )}
      {failed && (
        <p role="alert" className="text-xs text-lumen-danger">
          {labels.saveFailed}
        </p>
      )}
    </div>
  );
}
