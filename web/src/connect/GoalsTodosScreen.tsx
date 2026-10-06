import { useCallback, useMemo, useRef, useState } from "react";
import {
  BottomSheet,
  ConfirmDialog,
  GoalDetailPanel,
  GoalTreeView,
  RightSidebarPortal,
  buildGoalTreeModel,
  generateId,
  goalParentOptions,
  goalPeriodRanges,
  todayDateKey,
  useConfirmDialog,
  useDomainLoad,
  useMediaQuery,
  useRightSidebarOptional,
  useSyncDomains,
  useToastOptional,
  useTranslation,
  WEEK_STARTS_ON,
  WIDE_QUERY,
  type DataService,
  type Goal,
  type GoalDetailLabels,
  type GoalPeriodKind,
  type GoalTodoLink,
  type GoalTreeLabels,
  type TodoNode,
  type TodoStatus,
} from "@life-editor/shared";

/*
 * Connect's "Goals & Todos" tab host (#2108, plan Step 9). Same split as the
 * tag hub next door: this file fetches, resolves copy and writes; the tree
 * and the panel are the pure shared `GoalTreeView` / `GoalDetailPanel`, and
 * achievement is `judgeGoals` inside `buildGoalTreeModel` — never decided
 * here.
 *
 * Reads every live goal (a month's progress counts its past weeks), their
 * links and the todo list, re-read on the `goals` / `todos` sync domains and
 * after each of this screen's own writes (`reloadTick`), so the tree does not
 * wait for the Realtime echo.
 *
 * Wide: the picked goal goes to the shell's right panel. Narrow: the same
 * panel comes up as a bottom sheet, so creating, renaming and re-parenting
 * all work on a phone (brief §1.5).
 */

interface GoalsTodosScreenProps {
  dataService: DataService;
  onNavigateToItem: (target: { id: string; role: string }) => void;
}

interface GoalsSources {
  goals: Goal[];
  links: GoalTodoLink[];
  todos: TodoNode[];
}

const EMPTY_SOURCES: GoalsSources = { goals: [], links: [], todos: [] };

export function GoalsTodosScreen({
  dataService,
  onNavigateToItem,
}: GoalsTodosScreenProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const isWide = useMediaQuery(WIDE_QUERY, true);
  const syncVersion = useSyncDomains("goals", "todos");
  const [reloadTick, setReloadTick] = useState(0);
  const [sources, setSources] = useState<GoalsSources>(EMPTY_SOURCES);
  const [hasLoaded, setHasLoaded] = useState(false);
  /*
   * Todo ticks still being written, painted over every read until their write
   * settles. `updateTodo` is several requests in a row, so a read started by
   * its own Realtime echo (or by the previous tick's reloadTick) can land
   * before the status does and would un-tick the box for a moment.
   */
  const pendingTicks = useRef(
    new Map<string, { token: number; patch: Partial<TodoNode> }>(),
  );
  const tickToken = useRef(0);
  const overlayTicks = useCallback((next: GoalsSources): GoalsSources => {
    const pending = pendingTicks.current;
    if (pending.size === 0) return next;
    return {
      ...next,
      todos: next.todos.map((n) => {
        const tick = pending.get(n.id);
        return tick ? { ...n, ...tick.patch } : n;
      }),
    };
  }, []);

  const { isLoading, error } = useDomainLoad<GoalsSources>({
    domain: "Connect goals",
    dataService,
    version: syncVersion,
    anchor: reloadTick,
    refetchReportsLoading: false,
    load: async (service) => {
      const [goals, todos] = await Promise.all([
        service.fetchGoals(),
        service.fetchTodoTree(),
      ]);
      const links =
        goals.length > 0
          ? await service.fetchGoalTodoLinks(goals.map((g) => g.id))
          : [];
      return { goals, links, todos };
    },
    apply: (next) => {
      setSources(overlayTicks(next));
      setHasLoaded(true);
    },
    fallbackMessage: "Failed to load the goals",
  });
  // Only when nothing ever arrived: after one good read, a failed refetch
  // keeps the last tree (and its period counts) on screen.
  const loadFailed = error !== null && !hasLoaded;

  // The Briefing papers' "today" (day-start aware), so a goal set on the
  // paper at 1 AM lands in the same week here.
  const todayKey = todayDateKey();
  const model = useMemo(
    () =>
      buildGoalTreeModel({
        ...sources,
        todayKey,
        untitled: t("common.untitled"),
      }),
    [sources, todayKey, t],
  );

  const treeLabels = useMemo<GoalTreeLabels>(() => {
    const kinds = ["year", "month", "week"] as const;
    const map = (fn: (kind: GoalPeriodKind) => string) =>
      Object.fromEntries(kinds.map((k) => [k, fn(k)])) as Record<
        GoalPeriodKind,
        string
      >;
    const ranges = goalPeriodRanges(
      todayKey,
      WEEK_STARTS_ON,
      i18n.language.startsWith("ja") ? "ja-JP" : "en-US",
    );
    return {
      kinds: map((k) => t(`connect.goals.kinds.${k}`)),
      periods: map((k) => t(`connect.goals.periods.${k}`)),
      periodRanges: map((k) => ranges[k]),
      addHeading: t("connect.goals.addHeading"),
      addPlaceholder: t("connect.goals.addPlaceholder"),
      add: t("connect.goals.add"),
      cancel: t("connect.goals.cancel"),
      formatLimit: (period) => t("connect.goals.limit", { period }),
      treeHeading: t("connect.goals.treeHeading"),
      unconnectedHeading: t("connect.goals.unconnectedHeading"),
      looseHeading: t("connect.goals.looseHeading"),
      empty: t("connect.goals.empty"),
      emptyAction: t("connect.goals.emptyAction"),
      achieved: t("connect.goals.achieved"),
      unconnected: t("connect.goals.unconnected"),
      formatProgress: (done, total) =>
        t("connect.goals.progress", { done, total }),
      status: t("todoDetail.status"),
      statusLabels: {
        statusNotStarted: t("todoDetail.statusNotStarted"),
        statusDone: t("todoDetail.statusDone"),
      },
      formatOpenTodo: (title) => t("connect.goals.openTodo", { title }),
      loading: t("connect.goals.loading"),
      loadFailed: t("connect.goals.loadFailed"),
      retry: t("connect.goals.retry"),
    };
  }, [t, i18n.language, todayKey]);

  const detailLabels = useMemo<GoalDetailLabels>(
    () => ({
      titleLabel: t("connect.goals.titleLabel"),
      parentLabel: t("connect.goals.parentLabel"),
      parentNone: t("connect.goals.parentNone"),
      todosHeading: t("connect.goals.todosHeading"),
      todosEmpty: t("connect.goals.todosEmpty"),
      childrenHeading: t("connect.goals.childrenHeading"),
      formatEarlierChildren: (count) =>
        t("connect.goals.earlierChildren", { count }),
      markAchieved: t("connect.goals.markAchieved"),
      unmarkAchieved: t("connect.goals.unmarkAchieved"),
      manualHint: t("connect.goals.manualHint"),
      deleteGoal: t("connect.goals.deleteGoal"),
      formatPeriod: (kind, key) => t("connect.goals.period", { kind, key }),
      tree: treeLabels,
    }),
    [t, treeLabels],
  );

  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const selectedNode = selectedGoalId
    ? (model.byId.get(selectedGoalId) ?? null)
    : null;
  const rightSidebar = useRightSidebarOptional();
  const selectGoal = useCallback(
    (goalId: string) => {
      setSelectedGoalId(goalId);
      // Picking a goal with the panel shut would look like nothing happened.
      if (isWide && !rightSidebar?.isOpen) rightSidebar?.open();
    },
    [isWide, rightSidebar],
  );

  const toast = useToastOptional();
  /** Run one write, say so if it fails, and re-read either way. */
  const write = useCallback(
    async (run: () => Promise<unknown>): Promise<boolean> => {
      try {
        await run();
        return true;
      } catch (err) {
        console.error("[GoalsTodosScreen] write failed", err);
        toast?.showToast("danger", t("connect.goals.writeFailed"));
        return false;
      } finally {
        setReloadTick((n) => n + 1);
      }
    },
    [toast, t],
  );

  const createGoal = useCallback(
    async (kind: GoalPeriodKind, title: string): Promise<boolean> => {
      const id = generateId("goal");
      const ok = await write(() =>
        dataService.createGoal({
          id,
          title,
          periodKind: kind,
          periodKey: model.periodKeys[kind],
          sortOrder: model.periodCounts[kind],
        }),
      );
      // Picked straight away: the panel is where it gets its parent.
      if (ok) selectGoal(id);
      return ok;
    },
    [write, dataService, model, selectGoal],
  );

  const setTodoStatus = useCallback(
    (todoId: string, status: TodoStatus) => {
      const patch = {
        status,
        completedAt: status === "DONE" ? new Date().toISOString() : undefined,
      };
      // Painted first — the achievement chips follow the tick at once — and
      // held over every read until the write settles (pendingTicks).
      const token = ++tickToken.current;
      pendingTicks.current.set(todoId, { token, patch });
      setSources((prev) => overlayTicks(prev));
      void write(async () => {
        try {
          await dataService.updateTodo(todoId, patch);
        } finally {
          // A later tick on the same todo owns the entry now.
          if (pendingTicks.current.get(todoId)?.token === token) {
            pendingTicks.current.delete(todoId);
          }
        }
      });
    },
    [write, dataService, overlayTicks],
  );

  const openTodo = useCallback(
    (todoId: string) => onNavigateToItem({ id: todoId, role: "task" }),
    [onNavigateToItem],
  );

  const { request, ask, resolve } = useConfirmDialog();
  const deleteGoal = useCallback(
    (goal: Goal) => {
      void (async () => {
        const ok = await ask({
          message: t("connect.goals.deleteConfirm", { title: goal.title }),
          confirmLabel: t("connect.goals.deleteGoal"),
          cancelLabel: t("common.cancel"),
          danger: true,
        });
        if (!ok) return;
        if (await write(() => dataService.softDeleteGoal(goal.id))) {
          setSelectedGoalId(null);
        }
      })();
    },
    [ask, t, write, dataService],
  );

  const panel = selectedNode ? (
    <GoalDetailPanel
      key={selectedNode.goal.id}
      node={selectedNode}
      parentOptions={goalParentOptions(sources.goals, selectedNode.goal)}
      onRename={(title) =>
        void write(() =>
          dataService.updateGoal(selectedNode.goal.id, { title }),
        )
      }
      onChangeParent={(parentGoalId) =>
        void write(() =>
          dataService.updateGoal(selectedNode.goal.id, { parentGoalId }),
        )
      }
      onSetManualAchieved={(achieved) =>
        void write(() =>
          dataService.updateGoal(selectedNode.goal.id, {
            manualAchievedAt: achieved ? new Date().toISOString() : null,
          }),
        )
      }
      onDelete={() => deleteGoal(selectedNode.goal)}
      onSelectGoal={selectGoal}
      onSetTodoStatus={setTodoStatus}
      onOpenTodo={openTodo}
      labels={detailLabels}
    />
  ) : null;

  return (
    <>
      {isWide && panel && <RightSidebarPortal>{panel}</RightSidebarPortal>}
      <div className="h-full min-h-0 overflow-y-auto px-1 py-4 md:py-6">
        <GoalTreeView
          model={model}
          isLoading={isLoading}
          loadFailed={loadFailed}
          onRetry={() => setReloadTick((n) => n + 1)}
          selectedGoalId={selectedGoalId}
          onSelectGoal={selectGoal}
          onCreateGoal={createGoal}
          onSetTodoStatus={setTodoStatus}
          onOpenTodo={openTodo}
          labels={treeLabels}
        />
      </div>
      {!isWide && panel && selectedNode && (
        <BottomSheet
          open
          onClose={() => setSelectedGoalId(null)}
          title={t("connect.goals.sheetTitle", {
            title: selectedNode.goal.title,
          })}
          closeLabel={t("connect.sheetClose")}
        >
          {panel}
        </BottomSheet>
      )}
      {request && (
        <ConfirmDialog
          open
          message={request.message}
          confirmLabel={request.confirmLabel}
          cancelLabel={request.cancelLabel}
          danger={request.danger}
          onConfirm={() => resolve(true)}
          onCancel={() => resolve(false)}
        />
      )}
    </>
  );
}
