import { type SupabaseClient } from "@supabase/supabase-js";
import type { GoalsDataService } from "./DataService";
import type { Goal, GoalPeriodKind, GoalTodoLink } from "../types/goal";
import { goalPeriodKey } from "../utils/goalAchievement";
import { generateId } from "../utils/generateId";
import {
  GOALS_PAYLOAD_COLUMNS,
  GOAL_TODO_LINK_COLUMNS,
  ITEMS_META_GOAL_COLUMNS,
  assertGoalParentKind,
  assertGoalPeriod,
  goalCreateToRows,
  goalUpdatesToPatches,
  rowToGoalTodoLink,
  rowsToGoal,
  type GoalCreateInput,
  type GoalTodoLinkRow,
  type GoalUpdates,
  type GoalsPayloadRow,
  type ItemsMetaGoalRow,
} from "./goalMapper";
import { fetchAllPages, fetchByIdChunks } from "./postgrestFetchAll";
import {
  fetchMaybeSingleRow,
  requireRowPair,
  requireSingleRow,
} from "./postgrestSingle";
import { fetchMetaFirstJoin } from "./itemsMetaJoin";
import { getAuthedUserId } from "./supabaseServiceHelpers";

/*
 * Goals (#2103, plan Step 3) over items_meta (role `goal`) + goals_payload,
 * and the goal ↔ todo edges in goal_todo_links (migration 0034).
 *
 * Every items_meta write is filtered by `role = 'goal'` (the #1098 / #1099
 * rule: an id alone is not a safe address once ids can change role), and
 * every goal UPDATE bumps items_meta.updated_at through goalUpdatesToPatches
 * (DB-Q2 — goals_payload carries no cursor of its own).
 *
 * What this layer does NOT enforce: the three-goals-per-period limit (the MCP
 * tools and the screen own it — Issue #2103), and achievement, which is the
 * pure `judgeGoals` over what these reads return.
 *
 * Hard delete is not offered yet: the 0034 parent FK is NO ACTION, so a purge
 * has to choose what happens to the children first, and no caller needs one
 * until a Trash surface for goals exists.
 */
export class SupabaseGoalsService implements GoalsDataService {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /** Every live goal, all periods. */
  async fetchGoals(): Promise<Goal[]> {
    return fetchMetaFirstJoin<ItemsMetaGoalRow, GoalsPayloadRow, Goal>({
      client: this.client,
      role: "goal",
      isDeleted: false,
      metaColumns: ITEMS_META_GOAL_COLUMNS,
      metaLabel: "fetchGoals items_meta",
      payloadTable: "goals_payload",
      payloadColumns: GOALS_PAYLOAD_COLUMNS,
      payloadLabel: "fetchGoals goals_payload",
      toDomain: rowsToGoal,
    });
  }

  /** Live goals of one period (`kind` + its key — see goalPeriodKey). */
  async fetchGoalsInPeriod(
    kind: GoalPeriodKind,
    periodKey: string,
  ): Promise<Goal[]> {
    assertGoalPeriod("fetchGoalsInPeriod", kind, periodKey);
    return this.fetchByPeriodKeys(
      [{ kind, key: periodKey }],
      "fetchGoalsInPeriod",
    );
  }

  /** Live goals of the year, month and week (Sunday start) `dateKey` is in. */
  async fetchGoalsForDate(dateKey: string): Promise<Goal[]> {
    const kinds: readonly GoalPeriodKind[] = ["year", "month", "week"];
    return this.fetchByPeriodKeys(
      kinds.map((kind) => ({ kind, key: goalPeriodKey(kind, dateKey) })),
      "fetchGoalsForDate",
    );
  }

  /**
   * Payload-first: the period lives on goals_payload, so the ids are only
   * known after that read. The key's shape already implies its kind (0034
   * CHECK), so one `.in("period_key")` covers several kinds; the kind is
   * still compared in memory so a key can never match the wrong kind.
   */
  private async fetchByPeriodKeys(
    periods: ReadonlyArray<{ kind: GoalPeriodKind; key: string }>,
    label: string,
  ): Promise<Goal[]> {
    const wanted = new Set(periods.map((p) => `${p.kind}:${p.key}`));
    const payloads = (
      await fetchAllPages<GoalsPayloadRow>(
        (from, to) =>
          this.client
            .from("goals_payload")
            .select(GOALS_PAYLOAD_COLUMNS)
            .in(
              "period_key",
              periods.map((p) => p.key),
            )
            .order("item_id")
            .range(from, to),
        `${label} goals_payload`,
      )
    ).filter((p) => wanted.has(`${p.period_kind}:${p.period_key}`));
    if (payloads.length === 0) return [];

    const metas = await fetchByIdChunks<ItemsMetaGoalRow>(
      payloads.map((p) => p.item_id),
      (chunk) =>
        fetchAllPages(
          (from, to) =>
            this.client
              .from("items_meta")
              .select(ITEMS_META_GOAL_COLUMNS)
              .in("id", chunk)
              .eq("role", "goal")
              .eq("is_deleted", false)
              .order("id")
              .range(from, to),
          `${label} items_meta`,
        ),
    );
    const metaById = new Map(metas.map((m) => [m.id, m]));
    const out: Goal[] = [];
    for (const payload of payloads) {
      const meta = metaById.get(payload.item_id);
      if (meta) out.push(rowsToGoal(meta, payload));
    }
    return out.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
    );
  }

  /**
   * INSERT items_meta + goals_payload with R2 recovery (the meta row is
   * hard-deleted if the payload INSERT fails), same as createRoutine.
   */
  async createGoal(input: GoalCreateInput): Promise<Goal> {
    const userId = await getAuthedUserId(this.client);
    const { meta, payload } = goalCreateToRows(input, userId);
    if (payload.parent_goal_id !== null) {
      await this.assertParent(
        "createGoal",
        input.periodKind,
        payload.parent_goal_id,
      );
    }

    const metaRow = await requireSingleRow<ItemsMetaGoalRow>(
      this.client
        .from("items_meta")
        .insert(meta)
        .select(ITEMS_META_GOAL_COLUMNS)
        .single(),
      "createGoal items_meta",
    );
    try {
      const payloadRow = await requireSingleRow<GoalsPayloadRow>(
        this.client
          .from("goals_payload")
          .insert(payload)
          .select(GOALS_PAYLOAD_COLUMNS)
          .single(),
        "createGoal goals_payload",
      );
      return rowsToGoal(metaRow, payloadRow);
    } catch (err) {
      await this.client
        .from("items_meta")
        .delete()
        .eq("id", meta.id)
        .eq("role", "goal");
      throw err;
    }
  }

  async updateGoal(id: string, updates: GoalUpdates): Promise<Goal> {
    const { metaPatch, payloadPatch } = goalUpdatesToPatches(
      updates,
      new Date().toISOString(),
    );
    if (payloadPatch.parent_goal_id) {
      if (payloadPatch.parent_goal_id === id) {
        throw new Error(`updateGoal: ${id} cannot be its own parent`);
      }
      const own = await fetchMaybeSingleRow<
        Pick<GoalsPayloadRow, "period_kind">
      >(
        this.client
          .from("goals_payload")
          .select("period_kind")
          .eq("item_id", id)
          .maybeSingle(),
        "updateGoal read goals_payload",
      );
      if (!own) throw new Error(`updateGoal: no goal ${id}`);
      await this.assertParent(
        "updateGoal",
        own.period_kind,
        payloadPatch.parent_goal_id,
      );
    }

    // items_meta first and ALWAYS (DB-Q2 bump), with the row count read back
    // so a non-goal id fails here instead of patching someone else's payload.
    const { data: bumped, error: metaErr } = await this.client
      .from("items_meta")
      .update(metaPatch)
      .eq("id", id)
      .eq("role", "goal")
      .select("id");
    if (metaErr) throw new Error(`updateGoal items_meta: ${metaErr.message}`);
    if (!bumped || bumped.length === 0) {
      throw new Error(`updateGoal: no goal ${id}`);
    }

    if (Object.keys(payloadPatch).length > 0) {
      const { error: pErr } = await this.client
        .from("goals_payload")
        .update(payloadPatch)
        .eq("item_id", id);
      if (pErr) throw new Error(`updateGoal goals_payload: ${pErr.message}`);
    }

    const [metaRow, payloadRow] = await requireRowPair<
      ItemsMetaGoalRow,
      GoalsPayloadRow
    >(
      this.client
        .from("items_meta")
        .select(ITEMS_META_GOAL_COLUMNS)
        .eq("id", id)
        .eq("role", "goal")
        .single(),
      "updateGoal read items_meta",
      this.client
        .from("goals_payload")
        .select(GOALS_PAYLOAD_COLUMNS)
        .eq("item_id", id)
        .single(),
      "updateGoal read goals_payload",
    );
    return rowsToGoal(metaRow, payloadRow);
  }

  /** The parent must be a live goal one level up (year → month → week). */
  private async assertParent(
    label: string,
    childKind: GoalPeriodKind,
    parentId: string,
  ): Promise<void> {
    const [parentMeta, parentPayload] = await Promise.all([
      fetchMaybeSingleRow<Pick<ItemsMetaGoalRow, "is_deleted">>(
        this.client
          .from("items_meta")
          .select("is_deleted")
          .eq("id", parentId)
          .eq("role", "goal")
          .maybeSingle(),
        `${label} read parent items_meta`,
      ),
      fetchMaybeSingleRow<Pick<GoalsPayloadRow, "period_kind">>(
        this.client
          .from("goals_payload")
          .select("period_kind")
          .eq("item_id", parentId)
          .maybeSingle(),
        `${label} read parent goals_payload`,
      ),
    ]);
    if (!parentMeta || !parentPayload || parentMeta.is_deleted) {
      throw new Error(`${label}: parent goal ${parentId} is not a live goal`);
    }
    assertGoalParentKind(label, childKind, parentPayload.period_kind);
  }

  async softDeleteGoal(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("items_meta")
      .update({ is_deleted: true, deleted_at: now, updated_at: now })
      .eq("id", id)
      .eq("role", "goal");
    if (error) throw new Error(`softDeleteGoal: ${error.message}`);
  }

  async restoreGoal(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("items_meta")
      .update({ is_deleted: false, deleted_at: null, updated_at: now })
      .eq("id", id)
      .eq("role", "goal");
    if (error) throw new Error(`restoreGoal: ${error.message}`);
  }

  // -------------------------------------------------------------------------
  // goal ↔ todo (goal_todo_links — its own updated_at, like wiki_tag_connections)
  // -------------------------------------------------------------------------

  /** Live links of the given goals. */
  async fetchGoalTodoLinks(
    goalIds: readonly string[],
  ): Promise<GoalTodoLink[]> {
    const rows = await fetchByIdChunks<GoalTodoLinkRow>(goalIds, (chunk) =>
      fetchAllPages(
        (from, to) =>
          this.client
            .from("goal_todo_links")
            .select(GOAL_TODO_LINK_COLUMNS)
            .in("goal_id", chunk)
            .eq("is_deleted", false)
            .order("id")
            .range(from, to),
        "fetchGoalTodoLinks",
      ),
    );
    return rows.map(rowToGoalTodoLink);
  }

  /**
   * Idempotent: linking a pair that is already linked returns the live row.
   * The partial UNIQUE (0034 `uq_gtl_goal_todo`) is what decides; a lookup
   * first only saves the doomed INSERT in the common repeat case.
   */
  async linkGoalTodo(goalId: string, todoId: string): Promise<GoalTodoLink> {
    const existing = await this.findLiveLink(goalId, todoId);
    if (existing) return existing;

    const { data, error } = await this.client
      .from("goal_todo_links")
      .insert({ id: generateId("goallink"), goal_id: goalId, todo_id: todoId })
      .select(GOAL_TODO_LINK_COLUMNS)
      .single();
    if (error) {
      // 23505 = another device linked the same pair between the two calls.
      if (error.code === "23505") {
        const raced = await this.findLiveLink(goalId, todoId);
        if (raced) return raced;
      }
      throw new Error(`linkGoalTodo: ${error.message}`);
    }
    return rowToGoalTodoLink(data as unknown as GoalTodoLinkRow);
  }

  /** Soft-delete the live link of the pair; a missing link is a no-op. */
  async unlinkGoalTodo(goalId: string, todoId: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from("goal_todo_links")
      .update({ is_deleted: true, deleted_at: now, updated_at: now })
      .eq("goal_id", goalId)
      .eq("todo_id", todoId)
      .eq("is_deleted", false);
    if (error) throw new Error(`unlinkGoalTodo: ${error.message}`);
  }

  private async findLiveLink(
    goalId: string,
    todoId: string,
  ): Promise<GoalTodoLink | null> {
    const row = await fetchMaybeSingleRow<GoalTodoLinkRow>(
      this.client
        .from("goal_todo_links")
        .select(GOAL_TODO_LINK_COLUMNS)
        .eq("goal_id", goalId)
        .eq("todo_id", todoId)
        .eq("is_deleted", false)
        .maybeSingle(),
      "linkGoalTodo read",
    );
    return row ? rowToGoalTodoLink(row) : null;
  }
}

export const PHASE2_GOALS_METHOD_NAMES = [
  "fetchGoals",
  "fetchGoalsInPeriod",
  "fetchGoalsForDate",
  "createGoal",
  "updateGoal",
  "softDeleteGoal",
  "restoreGoal",
  "fetchGoalTodoLinks",
  "linkGoalTodo",
  "unlinkGoalTodo",
] as const;

export type GoalsMethodName = (typeof PHASE2_GOALS_METHOD_NAMES)[number];

export const PHASE2_GOALS_METHODS: ReadonlySet<string> = new Set(
  PHASE2_GOALS_METHOD_NAMES,
);
