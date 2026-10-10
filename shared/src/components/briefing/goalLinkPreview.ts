import type { Goal, GoalPeriodKind } from "../../types/goal";
import type { TodoNode } from "../../types/todoTree";
import {
  goalPeriodKey,
  judgeGoals,
  type GoalAchievement,
  type GoalAchievementInput,
  type GoalAchievementLink,
  type GoalAchievementTodo,
} from "../../utils/goalAchievement";

/*
 * "What will this change do to my goals?" (#2109, plan Step 10) — the numbers
 * the linking screens show BEFORE the user saves: 「企画書を通す 2/4 → 2/5」
 * and whether a goal becomes achieved or stops being achieved.
 *
 * No second rule: the answer is `judgeGoals` run twice, on the state as it is
 * and on the state with the edit applied, so the preview cannot disagree with
 * what the paper, Connect and the MCP tools say once the save lands. Parents
 * come along for free — a week that stops being achieved takes its month with
 * it, and the diff reports both.
 *
 * Pure (no React, no I/O): the goal side (GoalTodoLinkScreen), the todo side
 * (GoalPickerField in the todo detail and the create panel) and the hosts all
 * read the same functions.
 */

/** The achievement input with the goals' titles kept, for the screens. */
export interface GoalLinkState extends GoalAchievementInput {
  goals: readonly Goal[];
}

/** One goal's progress line: done of total, and the verdict. */
export interface GoalProgress {
  /** Done todos + achieved child goals. */
  done: number;
  /** Live linked todos + live child goals. */
  total: number;
  achieved: boolean;
  /** False = 未接続 (nothing linked at all). */
  connected: boolean;
}

export function goalProgressOf(judged: GoalAchievement): GoalProgress {
  return {
    done: judged.todos.done + judged.children.achieved,
    total: judged.todos.total + judged.children.total,
    achieved: judged.achieved,
    connected: judged.connected,
  };
}

export interface GoalTodoPair {
  goalId: string;
  todoId: string;
}

/** A proposed change, not yet written. */
export interface GoalLinkEdit {
  link?: readonly GoalTodoPair[];
  unlink?: readonly GoalTodoPair[];
  /**
   * Todos to add or replace by id: a todo that does not exist yet (the create
   * panel), or one whose done flag is about to flip (the status toggle).
   */
  todos?: readonly GoalAchievementTodo[];
}

export interface GoalProgressChange {
  goalId: string;
  before: GoalProgress;
  after: GoalProgress;
}

const pairKey = (p: GoalTodoPair): string => `${p.goalId}\u0000${p.todoId}`;

/** The state with `edit` applied. Unlinking soft-deletes, like the DB does. */
export function applyGoalLinkEdit(
  input: GoalAchievementInput,
  edit: GoalLinkEdit,
): GoalAchievementInput {
  const unlinked = new Set((edit.unlink ?? []).map(pairKey));
  const links: GoalAchievementLink[] = input.links.map((l) =>
    !l.isDeleted && unlinked.has(pairKey(l)) ? { ...l, isDeleted: true } : l,
  );
  const live = new Set(links.filter((l) => !l.isDeleted).map(pairKey));
  for (const pair of edit.link ?? []) {
    if (live.has(pairKey(pair))) continue;
    live.add(pairKey(pair));
    links.push({ ...pair, isDeleted: false });
  }
  const replaced = new Map((edit.todos ?? []).map((t) => [t.id, t]));
  const todos = input.todos.map((t) => replaced.get(t.id) ?? t);
  for (const t of replaced.values()) {
    if (!input.todos.some((existing) => existing.id === t.id)) todos.push(t);
  }
  return { goals: input.goals, todos, links };
}

const KIND_RANK: Readonly<Record<GoalPeriodKind, number>> = {
  week: 0,
  month: 1,
  year: 2,
};

const sameProgress = (a: GoalProgress, b: GoalProgress): boolean =>
  a.done === b.done &&
  a.total === b.total &&
  a.achieved === b.achieved &&
  a.connected === b.connected;

/**
 * Every live goal whose progress line would read differently after `edit`,
 * the direct targets (weeks) before the parents they drag along.
 */
export function previewGoalLinkEdit(
  input: GoalAchievementInput,
  edit: GoalLinkEdit,
): GoalProgressChange[] {
  const before = judgeGoals(input);
  const after = judgeGoals(applyGoalLinkEdit(input, edit));
  const changes: Array<GoalProgressChange & { rank: number }> = [];
  for (const goal of input.goals) {
    const b = before[goal.id];
    const a = after[goal.id];
    if (!b || !a) continue;
    const bp = goalProgressOf(b);
    const ap = goalProgressOf(a);
    if (sameProgress(bp, ap)) continue;
    changes.push({
      goalId: goal.id,
      before: bp,
      after: ap,
      rank: KIND_RANK[goal.periodKind],
    });
  }
  return changes
    .sort((x, y) => x.rank - y.rank)
    .map(({ goalId, before: b, after: a }) => ({
      goalId,
      before: b,
      after: a,
    }));
}

/** The goals an edit takes the achievement away from (the S1 / S2 chip). */
export function lostAchievementIds(
  changes: readonly GoalProgressChange[],
): string[] {
  return changes
    .filter((c) => c.before.achieved && !c.after.achieved)
    .map((c) => c.goalId);
}

/** A todo as the achievement rule reads it. */
export function toAchievementTodo(todo: TodoNode): GoalAchievementTodo {
  return {
    id: todo.id,
    done: todo.status === "DONE",
    isDeleted: todo.isDeleted === true,
  };
}

/** Goals + their links + the todo tree, as one state the screens read. */
export function toGoalLinkState(
  goals: readonly Goal[],
  links: readonly GoalAchievementLink[],
  todos: readonly TodoNode[],
): GoalLinkState {
  return { goals, links, todos: todos.map(toAchievementTodo) };
}

/** Ids of the goals `todoId` is linked to now. */
export function linkedGoalIds(
  links: readonly GoalAchievementLink[],
  todoId: string,
): string[] {
  return links
    .filter((l) => !l.isDeleted && l.todoId === todoId)
    .map((l) => l.goalId);
}

/**
 * A picking draft, held as what the user changed rather than as the whole
 * selection. Re-applied to the LATEST saved links on every render, so a link
 * another device (or the MCP tools) added while the draft was open is kept by
 * the save instead of being quietly taken off again.
 */
export interface LinkDraft {
  add: readonly string[];
  remove: readonly string[];
}

/** The draft that turns `baseline` into `selected`. */
export function linkDraftOf(
  baseline: readonly string[],
  selected: readonly string[],
): LinkDraft {
  const base = new Set(baseline);
  const sel = new Set(selected);
  return {
    add: selected.filter((id) => !base.has(id)),
    remove: baseline.filter((id) => !sel.has(id)),
  };
}

/** The selection `draft` makes of `baseline` (null = nothing touched). */
export function applyLinkDraft(
  baseline: readonly string[],
  draft: LinkDraft | null,
): string[] {
  if (!draft) return [...baseline];
  const removed = new Set(draft.remove);
  const kept = baseline.filter((id) => !removed.has(id));
  const have = new Set(kept);
  return [...kept, ...draft.add.filter((id) => !have.has(id))];
}

/**
 * The goals a todo-side picker offers: the current week, month and year of
 * `todayKey` (week first — it is the period a todo usually serves), plus any
 * goal the todo is already linked to, so an old link can still be undone.
 */
export function goalsForTodoPicker(
  goals: readonly Goal[],
  todayKey: string,
  linkedIds: readonly string[],
): Goal[] {
  const linked = new Set(linkedIds);
  return goals
    .filter(
      (g) =>
        !g.isDeleted &&
        (linked.has(g.id) ||
          g.periodKey === goalPeriodKey(g.periodKind, todayKey)),
    )
    .sort(
      (a, b) =>
        KIND_RANK[a.periodKind] - KIND_RANK[b.periodKind] ||
        b.periodKey.localeCompare(a.periodKey) ||
        a.sortOrder - b.sortOrder,
    );
}
