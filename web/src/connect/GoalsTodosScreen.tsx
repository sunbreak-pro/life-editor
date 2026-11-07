import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  BottomSheet,
  Button,
  ConfirmDialog,
  DEFAULT_GOAL_TREE_ARRANGEMENT,
  DEFAULT_GOAL_TREE_FILTER,
  formatGoalPeriod,
  GoalDeleteDialog,
  GoalDetailPanel,
  GoalTodoLinkScreen,
  GoalTreeArrangePanel,
  GoalTreeView,
  RightSidebarPortal,
  arrangeGoalTree,
  buildGoalDeleteTree,
  buildGoalTreeModel,
  collectDescendantIds,
  describeGoalTreeFilter,
  generateId,
  generateTodoId,
  goalParentOptions,
  planGoalDelete,
  toGoalLinkState,
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
  type GoalDateRange,
  type GoalDeleteDialogLabels,
  type GoalDeleteGoalRow,
  type GoalLinkDiff,
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
import { confirmTodoDetailDelete } from "../shared/todoTrayDeleteGuard";
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
 * on a phone the tree draws no grip, so the panel keeps its parent select there
 * (#2410); wide, the panel's goal above is only a link.
 *
 * "Link todos" in the panel swaps it for the shared linking screen (#2109), in
 * the same right panel or sheet, until its cancel button or another goal.
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

/** One read, with the link-save fence it started under. */
interface GoalsRead {
  sources: GoalsSources;
  fence: number;
}

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

  /*
   * The link save's write fence, as in useGoalLinkSnapshot (#2109). A read that
   * started before or during a save returns the links from before part of it,
   * and landing that would wipe what the save has patched in. So the save moves
   * the fence at its start and its end, a read lands only if the fence did not
   * move under it, and the end of the save asks for one fresh read.
   */
  const linkWriteFence = useRef(0);

  const { isLoading, error } = useDomainLoad<GoalsRead>({
    domain: "Connect goals",
    dataService,
    version: syncVersion,
    anchor: reloadTick,
    refetchReportsLoading: false,
    load: async (service) => {
      const fence = linkWriteFence.current;
      const [goals, todos] = await Promise.all([
        service.fetchGoals(),
        service.fetchTodoTree(),
      ]);
      const links =
        goals.length > 0
          ? await service.fetchGoalTodoLinks(goals.map((g) => g.id))
          : [];
      return { sources: { goals, links, todos }, fence };
    },
    apply: ({ sources: next, fence }) => {
      if (fence === linkWriteFence.current) setSources(overlayTicks(next));
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

  const { treeLabels, detailLabels, linkLabels } = useGoalTreeLabels(todayKey);

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
      periods: treeLabels.periods,
      statusLabel: t("connect.goals.arrange.status"),
      statuses: {
        inProgress: t("connect.goals.arrange.inProgress"),
        achieved: t("connect.goals.achieved"),
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
  // The goal whose panel is showing the linking screen instead.
  const [linkingGoalId, setLinkingGoalId] = useState<string | null>(null);
  const rightSidebar = useRightSidebarOptional();
  const selectGoal = useCallback(
    (goalId: string) => {
      setSelectedGoalId(goalId);
      setLinkingGoalId(null);
      // Picking a goal with the panel shut would look like nothing happened.
      if (isWide && !rightSidebar?.isOpen) rightSidebar?.open();
    },
    [isWide, rightSidebar, setLinkingGoalId],
  );

  const toast = useToastOptional();
  /** Run one write, say so if it fails, and re-read either way. */
  const write = useCallback(
    async (
      run: () => Promise<unknown>,
      // A function when the copy depends on how far `run` got.
      failedKey:
        TranslationKey | (() => TranslationKey) = "connect.goals.writeFailed",
    ): Promise<boolean> => {
      try {
        await run();
        return true;
      } catch (err) {
        console.error("[GoalsTodosScreen] write failed", err);
        toast?.showToast(
          "danger",
          t(typeof failedKey === "function" ? failedKey() : failedKey),
        );
        return false;
      } finally {
        setReloadTick((n) => n + 1);
      }
    },
    [toast, t],
  );

  const createGoal = useCallback(
    async (
      kind: GoalPeriodKind,
      title: string,
      range: GoalDateRange | null,
    ): Promise<boolean> => {
      const id = generateId("goal");
      const ok = await write(() =>
        dataService.createGoal({
          id,
          title,
          periodKind: kind,
          periodKey: model.periodKeys[kind],
          // No limit per period any more (#2366): the count only orders it.
          sortOrder: model.periodCounts[kind],
          ...(range ?? {}),
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

  /*
   * The linking screen's save. Not through `write`: the screen says a failure
   * itself, so it needs the rejection, and it drops its draft on resolve, so
   * each link is patched in as it lands rather than after the re-read, behind
   * the fence (linkWriteFence) so a read older than the save cannot undo that.
   */
  const saveLinks = useCallback(
    async (goalId: string, diff: GoalLinkDiff): Promise<void> => {
      const without = (links: GoalTodoLink[], todoId: string): GoalTodoLink[] =>
        links.filter((l) => l.goalId !== goalId || l.todoId !== todoId);
      linkWriteFence.current += 1;
      try {
        for (const todoId of diff.link) {
          const row = await dataService.linkGoalTodo(goalId, todoId);
          setSources((prev) => ({
            ...prev,
            links: [...without(prev.links, todoId), row],
          }));
        }
        for (const todoId of diff.unlink) {
          await dataService.unlinkGoalTodo(goalId, todoId);
          setSources((prev) => ({
            ...prev,
            links: without(prev.links, todoId),
          }));
        }
      } finally {
        linkWriteFence.current += 1;
        setReloadTick((n) => n + 1);
      }
    },
    [dataService],
  );
  const linkState = useMemo(
    () => toGoalLinkState(sources.goals, sources.links, sources.todos),
    [sources],
  );
  const linkTodoOptions = useMemo(
    () =>
      sources.todos
        .filter((n) => n.type === "task" && !n.isDeleted)
        .map((n) => ({
          id: n.id,
          title: n.title || t("common.untitled"),
          done: n.status === "DONE",
        })),
    [sources.todos, t],
  );

  // One write for both the panel's title field and the tree's pencil (#2283).
  const renameGoal = useCallback(
    (goalId: string, title: string) =>
      void write(() => dataService.updateGoal(goalId, { title })),
    [write, dataService],
  );

  /*
   * A todo's pencil (#2388) opens the Schedule's todo editor over this tab
   * (#2362, the ItemPanel of #2218), so editing one does not leave the tree.
   * Its "Open in Schedule" still goes there. Without an ItemPanel Provider (a
   * standalone render) the pencil falls back to the old navigation.
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

  // #2401: the todo the panel is editing, marked in the tree behind it.
  const panelRequest = itemPanel?.request;
  const editingTodoId =
    panelRequest?.mode === "edit" && panelRequest.target.role === "task"
      ? panelRequest.target.id
      : null;

  /*
   * Deleting a goal (#2405): the panel's button and the row's bin both land
   * here. The list is fixed when the dialog opens, so the writes are exactly
   * what was shown, whatever a Realtime echo does meanwhile.
   */
  const [deleteTree, setDeleteTree] = useState<GoalDeleteGoalRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteClaimed = useRef(false);
  const closeDeleteDialog = (): void => setDeleteTree(null);
  const deleteGoal = useCallback(
    (goal: Goal) => {
      setDeleteTree(
        buildGoalDeleteTree({
          goal,
          ...sources,
          untitled: t("common.untitled"),
        }),
      );
    },
    [sources, t],
  );
  const confirmDelete = useCallback(
    (keptIds: ReadonlySet<string>) => {
      if (!deleteTree || deleteClaimed.current) return;
      deleteClaimed.current = true;
      setDeleting(true);
      const plan = planGoalDelete(deleteTree, keptIds);
      void (async () => {
        /*
         * One at a time and in this order: what stays is taken off first, and
         * the goal asked about goes last, so a write that fails stops here and
         * leaves that goal on the tree. The re-read then shows what is left,
         * and asking again lists only that.
         */
        const writes: (() => Promise<unknown>)[] = [
          ...plan.detachGoalIds.map(
            (id) => () => dataService.updateGoal(id, { parentGoalId: null }),
          ),
          ...plan.unlinks.map(
            ({ goalId, todoId }) =>
              () =>
                dataService.unlinkGoalTodo(goalId, todoId),
          ),
          ...plan.deleteTodoIds.map(
            (id) => () => dataService.softDeleteTodo(id),
          ),
          ...plan.deleteGoalIds.map(
            (id) => () => dataService.softDeleteGoal(id),
          ),
        ];
        let landed = false;
        const ok = await write(
          async () => {
            for (const run of writes) {
              await run();
              landed = true;
            }
          },
          () =>
            landed
              ? "connect.goals.deleteDialog.failed"
              : "connect.goals.deleteDialog.failedNothingDeleted",
        );
        deleteClaimed.current = false;
        setDeleting(false);
        setDeleteTree(null);
        if (ok) {
          setSelectedGoalId((current) =>
            current && plan.deleteGoalIds.includes(current) ? null : current,
          );
        }
      })();
    },
    [deleteTree, write, dataService],
  );
  const deleteLabels = useMemo<GoalDeleteDialogLabels>(
    () => ({
      kinds: treeLabels.kinds,
      title: t("connect.goals.deleteGoal"),
      close: t("common.close"),
      formatMessage: (title) =>
        t("connect.goals.deleteDialog.message", { title }),
      chooseHint: t("connect.goals.deleteDialog.chooseHint"),
      keepNote: t("connect.goals.deleteDialog.keepNote"),
      listLabel: t("connect.goals.deleteDialog.listLabel"),
      alwaysDeleted: t("connect.goals.deleteDialog.alwaysDeleted"),
      alsoLinked: t("connect.goals.deleteDialog.alsoLinked"),
      formatNestedTodos: (count) =>
        t("connect.goals.deleteDialog.nestedTodos", { count }),
      formatGoalRow: (kind, title) =>
        t("connect.goals.deleteDialog.goalRow", { kind, title }),
      formatTodoRow: (title) =>
        t("connect.goals.deleteDialog.todoRow", { title }),
      // "Week goal": the add menu's own phrasing for a goal of a period.
      formatGoalKind: treeLabels.formatChildGoal,
      todoKind: t("connect.goals.deleteDialog.todoKind"),
      kept: t("connect.goals.deleteDialog.kept"),
      untickAll: t("connect.goals.deleteDialog.untickAll"),
      tickAll: t("connect.goals.deleteDialog.tickAll"),
      formatSummary: (goals, todos) =>
        t("connect.goals.deleteDialog.summary", { goals, todos }),
      formatConfirm: (count) =>
        t("connect.goals.deleteDialog.confirmCount", { count }),
      formatPeriod: detailLabels.formatPeriod,
      formatDateRange: treeLabels.formatDateRange,
      deleting: t("connect.goals.deleteDialog.deleting"),
      cancel: t("common.cancel"),
    }),
    [t, treeLabels, detailLabels],
  );

  const { request, ask, resolve } = useConfirmDialog();

  /*
   * The bin on a todo row (#2388). This tab has no TodoTreeProvider, so the
   * write is the service's soft delete, over the same subtree the Provider's
   * softDelete takes: a child left behind would have no parent to hang under.
   * The question is the todo detail's, which names how many go along. Restored
   * from the trash, not by undo: nothing on this tab holds an undo entry.
   *
   * One write at a time, children first, stopping at the first failure: a
   * failure then leaves the parent alive with fewer children, never live
   * children under a parent in the trash. `collectDescendantIds` adds a node
   * only after its parent, so the reversed list reads children before parents.
   */
  const deleteTodo = useCallback(
    (todoId: string) => {
      void (async () => {
        const ok = await confirmTodoDetailDelete(sources.todos, todoId, ask, {
          confirm: (name) => t("todoDetail.todoDeleteConfirm", { name }),
          cascadeConfirm: (name, count) =>
            t("todoDetail.todoDeleteCascadeConfirm", { name, count }),
          untitled: t("common.untitled"),
          confirmLabel: t("todoDetail.todoDelete"),
          cancelLabel: t("common.cancel"),
        });
        if (!ok) return;
        const subtree = [
          ...collectDescendantIds(todoId, sources.todos),
        ].reverse();
        await write(async () => {
          for (const id of subtree) await dataService.softDeleteTodo(id);
        }, "connect.goals.deleteTodoFailed");
      })();
    },
    [sources.todos, ask, t, write, dataService],
  );

  /*
   * The "+" and the bin on each goal row (#2367). A todo added under a goal
   * is created and linked in one write; a child goal lands in the current
   * period of the kind picked at the "+", under the goal it was added from
   * (the service checks the parent again).
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
      onAddChildGoal: (parent, title, kind) =>
        write(() =>
          dataService.createGoal({
            id: generateId("goal"),
            title,
            periodKind: kind,
            periodKey: model.periodKeys[kind],
            sortOrder: model.periodCounts[kind],
            parentGoalId: parent.id,
          }),
        ),
      onDelete: deleteGoal,
    }),
    [write, dataService, model, deleteGoal],
  );

  const panel = !selectedNode ? null : linkingGoalId ===
    selectedNode.goal.id ? (
    <GoalTodoLinkScreen
      key={selectedNode.goal.id}
      goalId={selectedNode.goal.id}
      state={linkState}
      todos={linkTodoOptions}
      onSave={(diff) => saveLinks(selectedNode.goal.id, diff)}
      onClose={() => setLinkingGoalId(null)}
      labels={{
        ...linkLabels,
        periodLabel: formatGoalPeriod(selectedNode.goal, detailLabels),
      }}
    />
  ) : (
    <GoalDetailPanel
      // The title too: renamed from the tree's pencil (#2283), the panel's
      // field would keep the old name and write it back on its next blur.
      key={`${selectedNode.goal.id}:${selectedNode.goal.title}`}
      node={selectedNode}
      parentOptions={goalParentOptions(sources.goals, selectedNode.goal)}
      parentGoal={
        selectedNode.goal.parentGoalId
          ? (model.byId.get(selectedNode.goal.parentGoalId)?.goal ?? null)
          : null
      }
      parentSelect={!isWide}
      onLinkTodos={() => setLinkingGoalId(selectedNode.goal.id)}
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
  );

  return (
    <>
      {isWide && (
        <RightSidebarPortal>
          <div className="flex flex-col gap-5">
            {arrangePanel}
            {panel ? (
              <div className="border-t border-lumen-border pt-4">{panel}</div>
            ) : (
              <p className="text-xs text-lumen-text-tertiary">
                {t("connect.goals.pickHint")}
              </p>
            )}
          </div>
        </RightSidebarPortal>
      )}
      {/* The column is capped here, not in the section descriptor, because the
          tag tab shares that descriptor and stays fluid (#2606). The scroll box
          stays full width so its scrollbar sits at the screen's edge. */}
      <div className="h-full min-h-0 overflow-y-auto px-1 pt-4 pb-12 md:pt-6">
        <div data-goals-body className="mx-auto max-w-[48rem]">
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
            editingTodoId={editingTodoId}
            onDeleteTodo={deleteTodo}
            drag={isWide ? drag : undefined}
            onRenameGoal={renameGoal}
            // Wide: the edit icon also opens the panel for the other fields.
            onEditGoal={isWide ? selectGoal : undefined}
            rowActions={rowActions}
            labels={treeLabels}
          />
        </div>
      </div>
      {!isWide && panel && selectedNode && (
        <BottomSheet
          open
          onClose={() => {
            setSelectedGoalId(null);
            setLinkingGoalId(null);
          }}
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
      {deleteTree && (
        <GoalDeleteDialog
          tree={deleteTree}
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={closeDeleteDialog}
          labels={deleteLabels}
        />
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
