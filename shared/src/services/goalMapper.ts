import type {
  Goal,
  GoalPeriodEndDecision,
  GoalPeriodKind,
  GoalTodoLink,
} from "../types/goal";
import { isGoalPeriodKey } from "../utils/goalAchievement";
import {
  ITEMS_META_COLUMNS,
  assertItemsMetaPair,
  toItemsMetaInsertRow,
  toItemsMetaPatch,
  type ItemsMetaInsertRow,
  type ItemsMetaPatchInput,
  type ItemsMetaRow,
  type ItemsMetaUpdatePatch,
} from "./itemsMeta";

/*
 * Goals (#2103) — pure mapping between the domain `Goal` and the 2-row split
 * of migration 0034: `items_meta` (role `goal`: title, soft delete, the LWW
 * cursor) + `goals_payload` (everything else). Same shape as the other role
 * mappers; SupabaseGoalsService is the I/O layer.
 *
 * `goals_payload` has no `updated_at` (db-conventions §10 DB-Q2), so every
 * UPDATE goes through `toItemsMetaPatch`, which always sets
 * `items_meta.updated_at` — a payload-only change (sort order, the hand mark,
 * the period-end answer) still moves the cursor the other devices sync on.
 *
 * `goal_todo_links` is a relation table with its own `updated_at`, like
 * `wiki_tag_connections`; its row mapping lives here too.
 *
 * Plan (SSOT): .claude/docs/vision/plans/2026-10-03-briefing-goals-redesign.md
 */

export type ItemsMetaGoalRow = ItemsMetaRow<"goal">;
export type ItemsMetaGoalInsertRow = ItemsMetaInsertRow<"goal">;

export interface GoalsPayloadRow {
  item_id: string;
  user_id: string;
  period_kind: GoalPeriodKind;
  period_key: string;
  sort_order: number;
  parent_goal_id: string | null;
  manual_achieved_at: string | null;
  period_end_decision: GoalPeriodEndDecision | null;
  decided_at: string | null;
  carried_from_goal_id: string | null;
  legacy_key: string | null;
}

/** `parent_goal_role` is a generated column (0034) — never written. */
export type GoalsPayloadUpdatePatch = Partial<
  Omit<GoalsPayloadRow, "item_id" | "user_id" | "period_kind" | "period_key">
>;

export const ITEMS_META_GOAL_COLUMNS = ITEMS_META_COLUMNS;

export const GOALS_PAYLOAD_COLUMNS =
  "item_id, user_id, period_kind, period_key, sort_order, parent_goal_id, " +
  "manual_achieved_at, period_end_decision, decided_at, " +
  "carried_from_goal_id, legacy_key";

export interface GoalTodoLinkRow {
  id: string;
  user_id: string;
  goal_id: string;
  todo_id: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
}

export const GOAL_TODO_LINK_COLUMNS =
  "id, user_id, goal_id, todo_id, created_at, updated_at, is_deleted, deleted_at";

// ---------------------------------------------------------------------------
// Rules the DB cannot hold (0034 header: "DB で守らないこと")
// ---------------------------------------------------------------------------

/** The kind a goal's parent must be: week → month → year → none. */
export const GOAL_PARENT_KIND: Readonly<
  Record<GoalPeriodKind, GoalPeriodKind | null>
> = {
  week: "month",
  month: "year",
  year: null,
};

/**
 * Throw unless `key` is a valid key for `kind`. Stricter than the DB CHECK:
 * a week key must be a real Sunday (`isGoalPeriodKey`, #2102).
 */
export function assertGoalPeriod(
  label: string,
  kind: GoalPeriodKind,
  key: string,
): void {
  if (!isGoalPeriodKey(kind, key)) {
    throw new Error(`${label}: "${key}" is not a ${kind} period key`);
  }
}

/** Throw unless a `parentKind` goal may be the parent of a `childKind` one. */
export function assertGoalParentKind(
  label: string,
  childKind: GoalPeriodKind,
  parentKind: GoalPeriodKind,
): void {
  const expected = GOAL_PARENT_KIND[childKind];
  if (expected !== parentKind) {
    throw new Error(
      `${label}: a ${childKind} goal cannot have a ${parentKind} parent` +
        (expected ? ` (expected ${expected})` : " (it has no parent)"),
    );
  }
}

// ---------------------------------------------------------------------------
// SELECT: 2 rows -> Goal
// ---------------------------------------------------------------------------

export function rowsToGoal(
  meta: ItemsMetaGoalRow,
  payload: GoalsPayloadRow,
): Goal {
  assertItemsMetaPair("goalMapper", "goal", meta, payload);
  return {
    id: meta.id,
    title: meta.title,
    periodKind: payload.period_kind,
    periodKey: payload.period_key,
    sortOrder: payload.sort_order,
    parentGoalId: payload.parent_goal_id,
    manualAchievedAt: payload.manual_achieved_at,
    periodEndDecision: payload.period_end_decision,
    decidedAt: payload.decided_at,
    carriedFromGoalId: payload.carried_from_goal_id,
    legacyKey: payload.legacy_key,
    isDeleted: meta.is_deleted,
    createdAt: meta.created_at,
    updatedAt: meta.updated_at,
  };
}

export function rowToGoalTodoLink(row: GoalTodoLinkRow): GoalTodoLink {
  return {
    id: row.id,
    goalId: row.goal_id,
    todoId: row.todo_id,
    isDeleted: row.is_deleted,
  };
}

// ---------------------------------------------------------------------------
// INSERT: create input -> { meta, payload }
// ---------------------------------------------------------------------------

/** What a caller supplies to create a goal. The rest starts empty. */
export interface GoalCreateInput {
  id: string;
  title: string;
  periodKind: GoalPeriodKind;
  periodKey: string;
  sortOrder?: number;
  parentGoalId?: string | null;
  carriedFromGoalId?: string | null;
  legacyKey?: string | null;
}

export function goalCreateToRows(
  input: GoalCreateInput,
  userId: string,
): { meta: ItemsMetaGoalInsertRow; payload: GoalsPayloadRow } {
  assertGoalPeriod("goalCreateToRows", input.periodKind, input.periodKey);
  return {
    meta: toItemsMetaInsertRow({
      id: input.id,
      userId,
      role: "goal",
      title: input.title,
    }),
    payload: {
      item_id: input.id,
      user_id: userId,
      period_kind: input.periodKind,
      period_key: input.periodKey,
      sort_order: input.sortOrder ?? 0,
      parent_goal_id: input.parentGoalId ?? null,
      manual_achieved_at: null,
      period_end_decision: null,
      decided_at: null,
      carried_from_goal_id: input.carriedFromGoalId ?? null,
      legacy_key: input.legacyKey ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// UPDATE: Partial<Goal> -> { metaPatch, payloadPatch }
// ---------------------------------------------------------------------------

/**
 * What may change after creation. The period is fixed: moving a goal to the
 * next period is a carry-over, which creates a new goal
 * (`carriedFromGoalId`), so the history of the old one stays put.
 */
export type GoalUpdates = Partial<
  Pick<
    Goal,
    | "title"
    | "sortOrder"
    | "parentGoalId"
    | "manualAchievedAt"
    | "periodEndDecision"
  >
>;

/**
 * `decided_at` is not a caller field: it is stamped with `now` whenever a
 * period-end answer is set and cleared with it, which keeps the 0034 pair
 * CHECK (`goals_payload_decision_pair`) true by construction.
 */
export function goalUpdatesToPatches(
  updates: GoalUpdates,
  now: string,
): { metaPatch: ItemsMetaUpdatePatch; payloadPatch: GoalsPayloadUpdatePatch } {
  const metaFields: ItemsMetaPatchInput = {};
  if ("title" in updates) metaFields.title = updates.title;
  // DB-Q2: updated_at is set here whatever else is (or is not) patched.
  const metaPatch = toItemsMetaPatch(metaFields, now);

  // An `undefined` value means "not mentioned", never "clear": clearing is
  // an explicit null. A spread form value with an unset field must not wipe
  // the parent or the hand mark on every device.
  const payloadPatch: GoalsPayloadUpdatePatch = {};
  if (updates.sortOrder !== undefined)
    payloadPatch.sort_order = updates.sortOrder;
  if (updates.parentGoalId !== undefined)
    payloadPatch.parent_goal_id = updates.parentGoalId;
  if (updates.manualAchievedAt !== undefined)
    payloadPatch.manual_achieved_at = updates.manualAchievedAt;
  if (updates.periodEndDecision !== undefined) {
    const decision = updates.periodEndDecision;
    payloadPatch.period_end_decision = decision;
    payloadPatch.decided_at = decision === null ? null : now;
  }
  return { metaPatch, payloadPatch };
}
