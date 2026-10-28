import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  BottomSheet,
  Button,
  ConfirmDialog,
  DEFAULT_GOAL_TREE_ARRANGEMENT,
  DEFAULT_GOAL_TREE_FILTER,
  GoalDetailPanel,
  GoalTreeArrangePanel,
  GoalTreeView,
  RightSidebarPortal,
  arrangeGoalTree,
  buildGoalTreeModel,
  describeGoalTreeFilter,
  generateId,
  generateTodoId,
  goalParentOptions,
  todayDateKey,
  useConfirmDialog,
  useDomainLoad,
  useItemPanelOptional,
  useMediaQuery,
  useRightSidebarOptional,
  useSyncDomains,
  useToastOptional,
  useTranslation,
  WIDE_QUERY,
  type DataService,
  type Goal,
  type GoalPeriodKind,
  type GoalRowActions,
  type GoalTodoLink,
  type GoalTreeArrangeLabels,
  type GoalTreeArrangement,
  type GoalTreeDragHandlers,
  type ItemPanelOptions,
  type TodoNode,
  type TodoStatus,
  type TranslationKey,
} from "@life-editor/shared";
import { useGoalTreeLabels } from "./useGoalTreeLabels";

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
 *
 * Sort and filter (#2225) are held here, since the tree and the panel render
 * apart: wide, the controls sit at the top of the right panel at all times,
 * above the picked goal; narrow, a "Sort & filter" button over the tree opens
 * them in their own bottom sheet.
 *
 * Drag to re-parent a goal or move a todo between goals (#2226) is wide only:
 * on a phone the tree draws no grip, and the panel's parent field remains.
 */

interface GoalsTodosScreenProps {
  dataService: DataService;
  /** A todo with a day goes to that day (the panel's "Open in Schedule"). */
  onNavigateToItem: (target: {
    id: string;
    role: string;
    date?: string;
  }) => void;
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
  const { t } = useTranslation();
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
  const [arrangement, setArrangement] = useState<GoalTreeArrangement>(
    DEFAULT_GOAL_TREE_ARRANGEMENT,
  );
  const shownModel = useMemo(
    () => arrangeGoalTree(model, arrangement),
    [model, arrangement],
  );
  const [arrangeSheetOpen, setArrangeSheetOpen] = useState(false);

  const { treeLabels, detailLabels } = useGoalTreeLabels(todayKey);

  const arrangeLabels = useMemo<GoalTreeArrangeLabels>(
    () => ({
      heading: t("connect.goals.arrange.heading"),
      sortLabel: t("connect.goals.arrange.sort"),
      sorts: {
        standard: t("connect.goals.arrange.sortStandard"),
        progress: t("connect.goals.arrange.sortProgress"),
        name: t("connect.goals.arrange.sortName"),
      },
      periodLabel: t("connect.goals.arrange.period"),
      all: t("connect.goals.arrange.all"),
      kinds: treeLabels.kinds,
      statusLabel: t("connect.goals.arrange.status"),
      statuses: {
        inProgress: t("connect.goals.arrange.inProgress"),
        achieved: t("connect.goals.achieved"),
        unconnected: t("connect.goals.unconnected"),
      },
      hideDoneTodos: t("connect.goals.arrange.hideDoneTodos"),
    }),
    [t, treeLabels],
  );
  const activeFilters = describeGoalTreeFilter(
    arrangement.filter,
    arrangeLabels,
  );
  const resetFilters = useCallback(
    () =>
      setArrangement((prev) => ({
        ...prev,
        filter: DEFAULT_GOAL_TREE_FILTER,
      })),
    [],
  );
  const arrangePanel = (
    <GoalTreeArrangePanel
      arrangement={arrangement}
      onChange={setArrangement}
      labels={arrangeLabels}
    />
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
    async (
      run: () => Promise<unknown>,
      failedKey: TranslationKey = "connect.goals.writeFailed",
    ): Promise<boolean> => {
      try {
        await run();
        return true;
      } catch (err) {
        console.error("[GoalsTodosScreen] write failed", err);
        toast?.showToast("danger", t(failedKey));
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

  // "+ Todo" in the loose group: no goal, no date, at the top of the Todos
  // root like the Briefing's quick-create (useBriefingWrites).
  const createLooseTodo = useCallback(
    (title: string): Promise<boolean> => {
      const now = new Date().toISOString();
      return write(() =>
        dataService.createTodo({
          // `task-<ts+counter>`, the TodoNode id form (CLAUDE.md §4 / #1116).
          id: generateTodoId("task"),
          type: "task",
          title,
          status: "NOT_STARTED",
          parentId: null,
          order: 0,
          createdAt: now,
          updatedAt: now,
        }),
      );
    },
    [write, dataService],
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

  /*
   * Drag in the tree (#2226, Desktop only). The tree offers only the goals a
   * drop may land on; `updateGoal` checks the parent again (assertParent).
   */
  const drag = useMemo<GoalTreeDragHandlers>(
    () => ({
      onMoveGoal: (goalId, parentGoalId) =>
        void write(() => dataService.updateGoal(goalId, { parentGoalId })),
      // A move, not an add: off the goal the drag started under, onto the
      // one it landed on. A todo under several goals leaves only that one.
      onMoveTodo: (todoId, fromGoalId, toGoalId) =>
        void write(async () => {
          if (fromGoalId) await dataService.unlinkGoalTodo(fromGoalId, todoId);
          try {
            await dataService.linkGoalTodo(toGoalId, todoId);
          } catch (err) {
            // Put it back, so a failed move does not lose the link.
            if (fromGoalId) {
              await dataService
                .linkGoalTodo(fromGoalId, todoId)
                .catch((undoErr: unknown) =>
                  console.error("[GoalsTodosScreen] relink failed", undoErr),
                );
            }
            throw err;
          }
        }, "connect.goals.moveTodoFailed"),
    }),
    [write, dataService],
  );

  // One write for both the panel's title field and the tree's pencil (#2283).
  const renameGoal = useCallback(
    (goalId: string, title: string) =>
      void write(() => dataService.updateGoal(goalId, { title })),
    [write, dataService],
  );

  /*
   * A todo opens the Schedule's todo editor over this tab (#2362, the
   * ItemPanel of #2218), so editing one does not leave the tree. Its "Open in
   * Schedule" still goes there. Without an ItemPanel Provider (a standalone
   * render) the row falls back to the old navigation.
   */
  const itemPanel = useItemPanelOptional();
  const panelOptions = useMemo<ItemPanelOptions>(
    () => ({
      onOpenInSchedule: (target) =>
        onNavigateToItem(
          target.date === null
            ? { id: target.id, role: target.role }
            : { id: target.id, role: target.role, date: target.date },
        ),
      onNavigateToItem,
    }),
    [onNavigateToItem],
  );
  const openTodo = useCallback(
    (todoId: string) => {
      if (itemPanel)
        itemPanel.openEdit({ role: "task", id: todoId }, panelOptions);
      else onNavigateToItem({ id: todoId, role: "task" });
    },
    [itemPanel, panelOptions, onNavigateToItem],
  );
  // The panel writes through its own Providers; re-read once it shuts so the
  // tree does not wait for the Realtime echo.
  const panelOpen = itemPanel?.request != null;
  const wasPanelOpen = useRef(panelOpen);
  useEffect(() => {
    if (wasPanelOpen.current && !panelOpen) setReloadTick((n) => n + 1);
    wasPanelOpen.current = panelOpen;
  }, [panelOpen]);

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

  /*
   * The "+" and the bin on each goal row (#2367). A todo added under a goal
   * is created and linked in one write; a child goal lands in the current
   * period one level down, under the goal it was added from (the service
   * checks the parent again).
   */
  const rowActions = useMemo<GoalRowActions>(
    () => ({
      onAddTodo: (goalId, title) => {
        const now = new Date().toISOString();
        const id = generateTodoId("task");
        return write(async () => {
          await dataService.createTodo({
            id,
            type: "task",
            title,
            status: "NOT_STARTED",
            parentId: null,
            order: 0,
            createdAt: now,
            updatedAt: now,
          });
          await dataService.linkGoalTodo(goalId, id);
        });
      },
      onAddChildGoal: (parent, title) => {
        const kind: GoalPeriodKind =
          parent.periodKind === "year" ? "month" : "week";
        return write(() =>
          dataService.createGoal({
            id: generateId("goal"),
            title,
            periodKind: kind,
            periodKey: model.periodKeys[kind],
            sortOrder: model.periodCounts[kind],
            parentGoalId: parent.id,
          }),
        );
      },
      onDelete: deleteGoal,
    }),
    [write, dataService, model, deleteGoal],
  );

  const panel = selectedNode ? (
    <GoalDetailPanel
      // The title too: renamed from the tree's pencil (#2283), the panel's
      // field would keep the old name and write it back on its next blur.
      key={`${selectedNode.goal.id}:${selectedNode.goal.title}`}
      node={selectedNode}
      parentOptions={goalParentOptions(sources.goals, selectedNode.goal)}
      onRename={(title) => renameGoal(selectedNode.goal.id, title)}
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
      {isWide && (
        <RightSidebarPortal>
          <div className="flex flex-col gap-5">
            {arrangePanel}
            {panel && (
              <div className="border-t border-lumen-border pt-4">{panel}</div>
            )}
          </div>
        </RightSidebarPortal>
      )}
      <div className="h-full min-h-0 overflow-y-auto px-1 py-4 md:py-6">
        {!isWide && model.byId.size > 0 && !loadFailed && (
          <div className="mb-4 flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setArrangeSheetOpen(true)}
              leadingIcon={<SlidersHorizontal size={14} aria-hidden />}
              className="max-md:min-h-11"
            >
              {arrangeLabels.heading}
            </Button>
          </div>
        )}
        <GoalTreeView
          model={shownModel}
          activeFilters={activeFilters}
          onResetFilters={resetFilters}
          onCreateLooseTodo={createLooseTodo}
          isLoading={isLoading}
          loadFailed={loadFailed}
          onRetry={() => setReloadTick((n) => n + 1)}
          selectedGoalId={selectedGoalId}
          onSelectGoal={selectGoal}
          onCreateGoal={createGoal}
          onSetTodoStatus={setTodoStatus}
          onOpenTodo={openTodo}
          drag={isWide ? drag : undefined}
          onRenameGoal={renameGoal}
          // Wide: the edit icon also opens the panel for the other fields.
          onEditGoal={isWide ? selectGoal : undefined}
          rowActions={rowActions}
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
      {!isWide && arrangeSheetOpen && (
        <BottomSheet
          open
          onClose={() => setArrangeSheetOpen(false)}
          title={arrangeLabels.heading}
          closeLabel={t("connect.sheetClose")}
        >
          {arrangePanel}
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
