import { randomUUID } from "node:crypto";
import { getSupabase } from "../supabase.js";
import {
  goalPeriodKey,
  isGoalPeriodKey,
  judgeGoals,
  type GoalAchievement,
  type GoalPeriodEndDecision,
  type GoalPeriodKind,
} from "../utils/goalAchievement.js";
import {
  insertItem,
  requireMeta,
  softDeleteItem,
  updatePayload,
} from "../utils/items.js";
import { assertDateKey, localToday } from "../utils/localDate.js";
import { fetchAllPages, fetchByIdChunks } from "../utils/pagination.js";

/*
 * Goal handlers (#2104, plan Step 5) — goals linked to Todos, for Claude.
 *
 * Storage is migration 0034: items_meta (role `goal`: title, soft delete, the
 * LWW cursor) + goals_payload, and the goal ↔ todo edges in goal_todo_links.
 * The app's half is shared/src/services/SupabaseGoalsService.ts; the rules
 * the DB cannot hold are enforced here as well as there:
 *
 *   - at most GOALS_PER_PERIOD live goals per period (create and restore);
 *   - a parent is one level up only: year → month → week;
 *   - the hand mark (`manual_achieved_at`) only on an UNCONNECTED goal — a
 *     connected one is judged by its todos, or closed at period end with
 *     `period_end_decision = achieved`.
 *
 * Achievement is never stored: every read runs the pure `judgeGoals`
 * (utils/goalAchievement.ts, the copy of shared's) over the goals, their
 * descendants, their live links and the linked todos, so the tools and the
 * Briefing screen give the same answer for the same rows.
 *
 * Goal writes go through items.ts and bump items_meta.updated_at (§10.2).
 * A link is a relation row with its own updated_at, like wiki_tag_connections
 * (link_items) — linking does not touch the goal's meta row, same as the app.
 */

export const GOALS_PER_PERIOD = 3;

/** The kind a goal's parent must be (shared goalMapper GOAL_PARENT_KIND). */
const PARENT_KIND: Readonly<Record<GoalPeriodKind, GoalPeriodKind | null>> = {
  week: "month",
  month: "year",
  year: null,
};

const PERIOD_KINDS: readonly GoalPeriodKind[] = ["year", "month", "week"];

interface GoalsPayloadRow {
  item_id: string;
  period_kind: GoalPeriodKind;
  period_key: string;
  sort_order: number;
  parent_goal_id: string | null;
  manual_achieved_at: string | null;
  period_end_decision: GoalPeriodEndDecision | null;
  decided_at: string | null;
  carried_from_goal_id: string | null;
}

const PAYLOAD_COLUMNS =
  "item_id, period_kind, period_key, sort_order, parent_goal_id, " +
  "manual_achieved_at, period_end_decision, decided_at, carried_from_goal_id";

interface MetaRow {
  id: string;
  title: string;
  is_deleted: boolean;
}

interface LinkRow {
  goal_id: string;
  todo_id: string;
}

export interface GoalPeriod {
  kind: GoalPeriodKind;
  key: string;
}

export interface LinkedTodo {
  id: string;
  title: string;
  done: boolean;
}

export interface GoalView {
  id: string;
  title: string;
  periodKind: GoalPeriodKind;
  periodKey: string;
  sortOrder: number;
  parentGoalId: string | null;
  manualAchievedAt: string | null;
  periodEndDecision: GoalPeriodEndDecision | null;
  decidedAt: string | null;
  carriedFromGoalId: string | null;
  /** judgeGoals' answer: achieved / via / connected / todos / children. */
  achievement: GoalAchievement;
  /** The live todos linked DIRECTLY to this goal (subtasks are not followed). */
  todos: LinkedTodo[];
}

export interface GoalPeriodView extends GoalPeriod {
  goals: GoalView[];
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function fetchPayloads(
  column: "item_id" | "period_key" | "parent_goal_id",
  values: readonly string[],
): Promise<GoalsPayloadRow[]> {
  const { client } = await getSupabase();
  return fetchByIdChunks<GoalsPayloadRow>(values, (chunk) =>
    fetchAllPages(
      (from, to) =>
        client
          .from("goals_payload")
          .select(PAYLOAD_COLUMNS)
          .in(column, chunk)
          .order("item_id", { ascending: true })
          .range(from, to),
      `goals_payload by ${column}`,
    ),
  );
}

/** items_meta rows of one role, trashed ones included (`is_deleted` says). */
async function fetchMetas(
  ids: readonly string[],
  role: "goal" | "task",
): Promise<Map<string, MetaRow>> {
  const { client } = await getSupabase();
  const rows = await fetchByIdChunks<MetaRow>(ids, (chunk) =>
    fetchAllPages(
      (from, to) =>
        client
          .from("items_meta")
          .select("id, title, is_deleted")
          .eq("role", role)
          .in("id", chunk)
          .order("id", { ascending: true })
          .range(from, to),
      `${role} items_meta`,
    ),
  );
  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * Judge `roots` with everything their answer depends on: every descendant
 * goal (a year needs its months, a month its weeks — in any period), the live
 * links of all of them, and the linked todos. The descendant walk stops on a
 * cycle too, because an id already loaded is never asked for again.
 */
async function loadGoals(
  roots: readonly GoalsPayloadRow[],
): Promise<Map<string, GoalView>> {
  const payloadById = new Map(roots.map((p) => [p.item_id, p]));
  let frontier = [...payloadById.keys()];
  while (frontier.length > 0) {
    const children = await fetchPayloads("parent_goal_id", frontier);
    frontier = [];
    for (const child of children) {
      if (payloadById.has(child.item_id)) continue;
      payloadById.set(child.item_id, child);
      frontier.push(child.item_id);
    }
  }
  const goalIds = [...payloadById.keys()];
  if (goalIds.length === 0) return new Map();

  const { client } = await getSupabase();
  const [goalMetas, links] = await Promise.all([
    fetchMetas(goalIds, "goal"),
    fetchByIdChunks<LinkRow>(goalIds, (chunk) =>
      fetchAllPages(
        (from, to) =>
          client
            .from("goal_todo_links")
            .select("id, goal_id, todo_id")
            .in("goal_id", chunk)
            .eq("is_deleted", false)
            .order("id", { ascending: true })
            .range(from, to),
        "goal_todo_links",
      ),
    ),
  ]);

  const todoIds = [...new Set(links.map((l) => l.todo_id))];
  const [todoMetas, todoPayloads] = await Promise.all([
    fetchMetas(todoIds, "task"),
    fetchByIdChunks<{ item_id: string; status: string | null }>(
      todoIds,
      (chunk) =>
        fetchAllPages(
          (from, to) =>
            client
              .from("tasks_payload")
              .select("item_id, status")
              .in("item_id", chunk)
              .order("item_id", { ascending: true })
              .range(from, to),
          "linked tasks_payload",
        ),
    ),
  ]);
  const statusById = new Map(todoPayloads.map((p) => [p.item_id, p.status]));

  // A todo needs both rows; one without its payload is left out, which
  // judgeGoals reads as "not counted" (its rule for a partial todo list).
  const todos = todoIds.flatMap((id) => {
    const meta = todoMetas.get(id);
    if (!meta || !statusById.has(id)) return [];
    return [
      {
        id,
        title: meta.title,
        done: statusById.get(id) === "DONE",
        isDeleted: meta.is_deleted,
      },
    ];
  });
  const judged = judgeGoals({
    goals: goalIds.flatMap((id) => {
      const meta = goalMetas.get(id);
      const p = payloadById.get(id) as GoalsPayloadRow;
      if (!meta) return []; // a payload without its meta row is no goal
      return [
        {
          id,
          periodKind: p.period_kind,
          parentGoalId: p.parent_goal_id,
          manualAchievedAt: p.manual_achieved_at,
          periodEndDecision: p.period_end_decision,
          isDeleted: meta.is_deleted,
        },
      ];
    }),
    todos,
    links: links.map((l) => ({
      goalId: l.goal_id,
      todoId: l.todo_id,
      isDeleted: false,
    })),
  });

  const liveTodoById = new Map(
    todos.filter((t) => !t.isDeleted).map((t) => [t.id, t]),
  );
  const views = new Map<string, GoalView>();
  for (const [id, achievement] of Object.entries(judged)) {
    const p = payloadById.get(id) as GoalsPayloadRow;
    const linked = new Set(
      links.filter((l) => l.goal_id === id).map((l) => l.todo_id),
    );
    views.set(id, {
      ...payloadView(p, (goalMetas.get(id) as MetaRow).title),
      achievement,
      todos: [...linked].flatMap((todoId) => {
        const todo = liveTodoById.get(todoId);
        return todo
          ? [{ id: todo.id, title: todo.title, done: todo.done }]
          : [];
      }),
    });
  }
  return views;
}

function payloadView(
  p: GoalsPayloadRow,
  title: string,
): Omit<GoalView, "achievement" | "todos"> {
  return {
    id: p.item_id,
    title,
    periodKind: p.period_kind,
    periodKey: p.period_key,
    sortOrder: p.sort_order,
    parentGoalId: p.parent_goal_id,
    manualAchievedAt: p.manual_achieved_at,
    periodEndDecision: p.period_end_decision,
    decidedAt: p.decided_at,
    carriedFromGoalId: p.carried_from_goal_id,
  };
}

const bySortOrder = (a: GoalView, b: GoalView): number =>
  a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);

/** The live goals of each period, judged, in the order the periods came. */
export async function readGoalPeriods(
  periods: readonly GoalPeriod[],
): Promise<GoalPeriodView[]> {
  const wanted = new Set(periods.map((p) => `${p.kind}:${p.key}`));
  // The key's shape implies its kind (0034 CHECK), but the kind is compared
  // anyway so a key can never match the wrong kind.
  const roots = (
    await fetchPayloads("period_key", [...new Set(periods.map((p) => p.key))])
  ).filter((p) => wanted.has(`${p.period_kind}:${p.period_key}`));
  const views = await loadGoals(roots);
  return periods.map((period) => ({
    ...period,
    goals: roots
      .filter(
        (p) => p.period_kind === period.kind && p.period_key === period.key,
      )
      .flatMap((p) => {
        const view = views.get(p.item_id);
        return view ? [view] : [];
      })
      .sort(bySortOrder),
  }));
}

/** The year, month and week (Sunday start) that the day `date` falls in. */
export function periodsOfDate(date: string): GoalPeriod[] {
  return periodsOfDates([date]);
}

/**
 * Every year, month and week (Sunday start) that any of `dates` falls in,
 * once each: years first, then months, then weeks, each in date order.
 */
export function periodsOfDates(dates: readonly string[]): GoalPeriod[] {
  return PERIOD_KINDS.flatMap((kind) =>
    [...new Set(dates.map((date) => goalPeriodKey(kind, date)))].map((key) => ({
      kind,
      key,
    })),
  );
}

async function readGoal(id: string): Promise<GoalView> {
  const [payload] = await fetchPayloads("item_id", [id]);
  const view = payload ? (await loadGoals([payload])).get(id) : null;
  if (!view) throw new Error(`Goal not found: ${id}`);
  return view;
}

/** The live goals of one period: how many, and the next free sort order. */
async function periodRoom(
  period: GoalPeriod,
): Promise<{ live: number; nextSortOrder: number }> {
  const payloads = (await fetchPayloads("period_key", [period.key])).filter(
    (p) => p.period_kind === period.kind,
  );
  const metas = await fetchMetas(
    payloads.map((p) => p.item_id),
    "goal",
  );
  const live = payloads.filter(
    (p) => metas.get(p.item_id)?.is_deleted === false,
  );
  return {
    live: live.length,
    nextSortOrder: Math.max(-1, ...live.map((p) => p.sort_order)) + 1,
  };
}

/**
 * Throw when `period` already holds GOALS_PER_PERIOD live goals. Exported for
 * restore_item, which can otherwise bring a fourth one back from the trash.
 * Returns the next free sort order, which is what create_goal appends at.
 */
export async function assertPeriodHasRoom(
  period: GoalPeriod,
  label: string,
): Promise<number> {
  const room = await periodRoom(period);
  if (room.live >= GOALS_PER_PERIOD) {
    throw new Error(
      `${label}: the ${period.kind} ${period.key} already has ` +
        `${GOALS_PER_PERIOD} goals — move one to the trash with delete_goal first ` +
        "(a goal answered 'dropped' still counts)",
    );
  }
  return room.nextSortOrder;
}

/** The period a goal of `kind` lives in: an explicit key, else `date`'s. */
function resolvePeriod(
  label: string,
  kind: GoalPeriodKind,
  key: string | undefined | null,
  date: string | undefined | null,
): GoalPeriod {
  const resolved =
    key ?? goalPeriodKey(kind, assertDateKey(date ?? localToday()));
  if (!isGoalPeriodKey(kind, resolved)) {
    throw new Error(
      `${label}: "${resolved}" is not a ${kind} period key ` +
        `(year YYYY / month YYYY-MM / week = its Sunday, YYYY-MM-DD)`,
    );
  }
  return { kind, key: resolved };
}

/** The parent must be a live goal exactly one level up. */
async function assertParent(
  label: string,
  childKind: GoalPeriodKind,
  parentId: string,
): Promise<void> {
  await requireMeta(parentId, "goal", `${label}: parent goal`);
  const [parent] = await fetchPayloads("item_id", [parentId]);
  const expected = PARENT_KIND[childKind];
  if (!parent || parent.period_kind !== expected) {
    throw new Error(
      `${label}: a ${childKind} goal ` +
        (expected
          ? `takes a ${expected} goal as its parent`
          : "has no parent") +
        (parent ? ` (${parentId} is a ${parent.period_kind} goal)` : ""),
    );
  }
}

function requireTitle(label: string, title: string): string {
  const trimmed = title.trim();
  if (trimmed === "") throw new Error(`${label}: title must not be empty`);
  return trimmed;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export async function listGoals(args: {
  date?: string;
  period_kind?: GoalPeriodKind;
  period_key?: string;
}): Promise<{ periods: GoalPeriodView[] }> {
  if (args.period_key != null && args.period_kind == null) {
    throw new Error("list_goals: period_key needs period_kind");
  }
  const periods =
    args.period_kind != null
      ? [
          resolvePeriod(
            "list_goals",
            args.period_kind,
            args.period_key,
            args.date,
          ),
        ]
      : periodsOfDate(assertDateKey(args.date ?? localToday()));
  return { periods: await readGoalPeriods(periods) };
}

export async function createGoal(args: {
  title: string;
  period_kind: GoalPeriodKind;
  period_key?: string;
  date?: string;
  parent_id?: string;
  carried_from_id?: string;
}): Promise<GoalView> {
  const title = requireTitle("create_goal", args.title);
  const period = resolvePeriod(
    "create_goal",
    args.period_kind,
    args.period_key,
    args.date,
  );
  if (args.parent_id != null) {
    await assertParent("create_goal", period.kind, args.parent_id);
  }
  if (args.carried_from_id != null) {
    await requireMeta(
      args.carried_from_id,
      "goal",
      "create_goal: carried-from goal",
    );
  }
  const sortOrder = await assertPeriodHasRoom(period, "create_goal");

  const id = `goal-${randomUUID()}`;
  const payload: Omit<GoalsPayloadRow, "item_id"> = {
    period_kind: period.kind,
    period_key: period.key,
    sort_order: sortOrder,
    parent_goal_id: args.parent_id ?? null,
    manual_achieved_at: null,
    period_end_decision: null,
    decided_at: null,
    carried_from_goal_id: args.carried_from_id ?? null,
  };
  await insertItem({
    id,
    role: "goal",
    title,
    payloadTable: "goals_payload",
    payload: { ...payload },
  });

  // Nothing is linked to a goal that did not exist a moment ago, so its
  // judgement is known without reading it back.
  return {
    ...payloadView({ item_id: id, ...payload }, title),
    achievement: {
      achieved: false,
      via: null,
      connected: false,
      todos: { done: 0, total: 0 },
      children: { achieved: 0, total: 0 },
    },
    todos: [],
  };
}

export async function updateGoal(args: {
  id: string;
  title?: string | null;
  parent_id?: string | null;
  sort_order?: number | null;
  manual_achieved?: boolean;
  period_end_decision?: GoalPeriodEndDecision | null;
}): Promise<GoalView> {
  const current = await readGoal(args.id);
  const now = new Date().toISOString();

  const metaPatch: Record<string, unknown> = {};
  // The validator lets null through as "not supplied" (toolSchema.ts), so
  // title and sort_order — which have nothing to clear — treat it that way.
  if (args.title != null)
    metaPatch.title = requireTitle("update_goal", args.title);

  // `undefined` = not mentioned; an explicit null clears (parent, decision).
  const payloadPatch: Record<string, unknown> = {};
  if (args.parent_id !== undefined) {
    if (args.parent_id !== null) {
      if (args.parent_id === args.id) {
        throw new Error(`update_goal: ${args.id} cannot be its own parent`);
      }
      await assertParent("update_goal", current.periodKind, args.parent_id);
    }
    payloadPatch.parent_goal_id = args.parent_id;
  }
  if (args.sort_order != null) {
    payloadPatch.sort_order = Math.trunc(args.sort_order);
  }
  if (args.manual_achieved === true) {
    if (current.achievement.connected) {
      throw new Error(
        `update_goal: ${args.id} is connected to todos or goals, so those ` +
          "decide whether it is achieved. Once its period has ended, " +
          "period_end_decision 'achieved' can close it as achieved anyway.",
      );
    }
    // Keep the first mark's time: marking twice is not a new achievement.
    payloadPatch.manual_achieved_at = current.manualAchievedAt ?? now;
  } else if (args.manual_achieved === false) {
    payloadPatch.manual_achieved_at = null;
  }
  if (args.period_end_decision !== undefined) {
    // The answer belongs to the review after the period (D-20260928-briefing-4:
    // asked in the next period's first briefing). Mid-period, 'achieved' would
    // bypass the todos of a connected goal, so a decision waits for the end.
    // Keys of one kind compare as strings (YYYY / YYYY-MM / YYYY-MM-DD).
    if (args.period_end_decision !== null) {
      const thisPeriod = goalPeriodKey(current.periodKind, localToday());
      if (current.periodKey >= thisPeriod) {
        throw new Error(
          `update_goal: the ${current.periodKind} ${current.periodKey} of ` +
            `${args.id} has not ended yet — period_end_decision is answered ` +
            "after the period ends",
        );
      }
    }
    // decided_at is stamped with the answer and cleared with it — the 0034
    // pair CHECK (goals_payload_decision_pair), same as shared's mapper.
    payloadPatch.period_end_decision = args.period_end_decision;
    payloadPatch.decided_at = args.period_end_decision === null ? null : now;
  }

  // items.ts: an empty patch writes nothing, anything else bumps updated_at.
  await updatePayload(
    "goals_payload",
    args.id,
    "goal",
    payloadPatch,
    metaPatch,
  );
  return readGoal(args.id);
}

export async function deleteGoal(args: {
  id: string;
}): Promise<{ success: true; id: string; softDeleted: true }> {
  await requireMeta(args.id, "goal", "Goal");
  // Like the app's softDeleteGoal: child goals and todo links stay as they
  // are, so restore_item brings the goal back whole.
  await softDeleteItem(args.id, "goal");
  return { success: true, id: args.id, softDeleted: true };
}

async function findLiveLink(
  goalId: string,
  todoId: string,
): Promise<{ id: string } | null> {
  const { client } = await getSupabase();
  const { data, error } = await client
    .from("goal_todo_links")
    .select("id")
    .eq("goal_id", goalId)
    .eq("todo_id", todoId)
    .eq("is_deleted", false)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`get goal_todo_links: ${error.message}`);
  return (data as { id: string } | null) ?? null;
}

export async function linkGoalTodo(args: {
  goal_id: string;
  todo_id: string;
}): Promise<{ linkId: string; created: boolean; goal: GoalView }> {
  await requireMeta(args.goal_id, "goal", "Goal");
  await requireMeta(args.todo_id, "task", "Todo");

  const existing = await findLiveLink(args.goal_id, args.todo_id);
  if (existing) {
    // Already the asked-for state: no write, so no cursor moves for nothing.
    return {
      linkId: existing.id,
      created: false,
      goal: await readGoal(args.goal_id),
    };
  }

  const { client, userId } = await getSupabase();
  const linkId = `goallink-${randomUUID()}`;
  const { error } = await client.from("goal_todo_links").insert({
    id: linkId,
    user_id: userId,
    goal_id: args.goal_id,
    todo_id: args.todo_id,
    is_deleted: false,
    deleted_at: null,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    // 23505 = the partial UNIQUE uq_gtl_goal_todo: another device linked the
    // same pair between the lookup and the insert. The pair is linked, which
    // is what was asked — same recovery as shared's linkGoalTodo.
    if (error.code === "23505") {
      const raced = await findLiveLink(args.goal_id, args.todo_id);
      if (raced) {
        return {
          linkId: raced.id,
          created: false,
          goal: await readGoal(args.goal_id),
        };
      }
    }
    throw new Error(`create goal_todo_links: ${error.message}`);
  }
  return { linkId, created: true, goal: await readGoal(args.goal_id) };
}

export async function unlinkGoalTodo(args: {
  goal_id: string;
  todo_id: string;
}): Promise<{ removed: boolean; goal: GoalView }> {
  // Refuse a trashed goal before writing, as link_goal_todo does — otherwise
  // the link is removed and readGoal then fails, reporting an error for a
  // write that went through.
  await requireMeta(args.goal_id, "goal", "Goal");
  const existing = await findLiveLink(args.goal_id, args.todo_id);
  if (existing) {
    // SOFT delete: the sync layer diffs against the row (link_items' rule).
    const now = new Date().toISOString();
    const { client } = await getSupabase();
    const { error } = await client
      .from("goal_todo_links")
      .update({ is_deleted: true, deleted_at: now, updated_at: now })
      .eq("id", existing.id);
    if (error) throw new Error(`delete goal_todo_links: ${error.message}`);
  }
  return { removed: existing !== null, goal: await readGoal(args.goal_id) };
}

/**
 * restore_item's goal check: the period of the trashed goal `id` must still
 * have room. A goal whose payload is missing has no period to fill.
 */
export async function assertGoalRestorable(id: string): Promise<void> {
  const [payload] = await fetchPayloads("item_id", [id]);
  if (!payload) return;
  await assertPeriodHasRoom(
    { kind: payload.period_kind, key: payload.period_key },
    "restore_item",
  );
}
