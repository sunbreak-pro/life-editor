import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  closestCorners,
} from "@dnd-kit/core";
import { ListTodo, Plus } from "lucide-react";
import {
  ConfirmDialog,
  useConfirmDialog,
  KanbanBoard,
  KanbanCard,
  STATUS_TEXT_KEY,
  buildStatusColumns,
  buildTagColumns,
  EmptyState,
  SkeletonList,
  RightSidebarPortal,
  TaskDetailPanel,
  type TaskDetailPatch,
  TaskStatusChoices,
  TaskAddDialog,
  useMediaQuery,
  useRightSidebarContext,
  useTaskTreeContext,
  useWikiTagsUnifiedContext,
  useTranslation,
  useUnsavedDraft,
  useInFlightGuard,
  readKanbanViewMode,
  persistKanbanViewMode,
  todayCalendarKey,
  todoToEventBlock,
  taskToEventPlacement,
  ItemConversionError,
  logServiceError,
  type DataService,
  type KanbanCardModel,
  type KanbanCardTag,
  type KanbanColumnModel,
  type KanbanLabels,
  type KanbanViewMode,
  type TaskAddType,
  type TaskNode,
  WIDE_QUERY,
} from "@life-editor/shared";
// Section-agnostic despite living under schedule/ (#628 → #707 → #736): the two
// facts it pins — never ask when nothing is pending, never treat a pending
// promise as a "yes" — hold for any editor whose only commit is a button.
import { decideUnsavedClose } from "../schedule/unsavedCloseGuard";
// Imported ACROSS sections on purpose (#786): the todo detail's delete question
// is one behaviour on two screens, and the count it names has to agree wherever
// it is asked. Left where #775 put it rather than moved to a neutral home — a
// parallel lane is editing schedule/ right now, and a file move would collide
// with it for no gain.
import { confirmTodoDetailDelete } from "../schedule/todoTrayDeleteGuard";
import { useKanbanDnd } from "./useKanbanDnd";
import { useTaskDetailTarget } from "./useTaskDetailTarget";
import { useTaskLinking } from "./hooks/useTaskLinking";
import { KanbanColumnDroppable } from "./KanbanColumnDroppable";
import { MobileTaskList } from "./MobileTaskList";
import { RichTextEditor } from "../notes/RichTextEditor";
import { TagPicker } from "../wikitag/TagPicker";

/*
 * Web Tasks Kanban host (K1 + K-DnD + K2 + K3). Replaces the tree in the
 * Tasks section. Owns the data + i18n wiring; the shared <KanbanBoard> and
 * its children stay pure (§6.4):
 *
 *   - data: useTaskTreeContext() → nodes / status mutations;
 *     useWikiTagsUnifiedContext() → tag master + assignments + tag color.
 *     Columns are built by the pure shared builders, keyed off the active
 *     view mode (status / tag — folder view retired in life-tags S1).
 *   - i18n: useTranslation() here → a KanbanLabels object injected as props.
 *
 * K-DnD (status view only): drag a card between status columns to SET the task
 * status (setTaskStatus).
 *   - tag view: NOT draggable (reassigning a multi-tag card by drag is
 *     ambiguous) — the host renders the plain board there.
 *
 * K2: tag-by view (one column per tag + an "untagged" bucket) and tag color
 * editing. The host resolves each task's tags from the WikiTags context
 * (getTagsForItem) and persists color changes via setTagColor.
 *
 * K3: clicking a card opens the selected task in the right sidebar via
 * <RightSidebarPortal>, hosting the shared <TaskDetailPanel> + the web TipTap
 * editor + (#412) the <TagPicker>, so tags are attached and detached from the
 * detail the user is already reading. On narrow the same panel opens in the
 * MobileTaskList bottom sheet (#470 — mobile-scope.md #6 Phase 2), with the
 * three-choice touch status row swapped in for the cycle button. DnD and the
 * column operations stay Desktop-only. The board itself stays read-only about
 * tags: in tag view a column IS an assignment, so editing tags on a card would
 * move that card out from under the pointer mid-interaction (same reason the
 * tag view is not draggable).
 *
 * Layout: the full-width DnD board is the Tasks view (the old list mode was
 * retired 2026-07-18 — Board only). Cards + @dnd-kit + card-click → the
 * selected task's detail in the rightSidebar. The grouping axis (viewMode:
 * status / tag) lives in the board's own switch (persistKanbanViewMode).
 *
 * @dnd-kit lives only in web/ (useKanbanDnd + KanbanColumnDroppable +
 * KanbanCardDraggable); the shared Kanban package never imports it.
 */

/*
 * The task body's draft (#713).
 *
 * The panel is shared and the editor is a web dependency it can only take as a
 * slot, so the two halves of one save press start apart: the panel knows the
 * title, this knows the body. It hands both to the press.
 *
 * A component of its own, mounted with `key={task.id}` inside the detail, so
 * the draft lives exactly as long as the surface showing it. That is the whole
 * discard story: closing without saving unmounts this, and reopening the same
 * task cannot find yesterday's typing still pending. Keeping it in the board's
 * state instead would need every close path to remember to clear it — and the
 * board would re-render all its columns on every keystroke, for a value only
 * this subtree reads.
 */
function TaskBodyDraft({
  onSave,
  children,
}: {
  onSave: (id: string, patch: TaskDetailPatch, content?: string) => void;
  children: (draft: {
    dirty: boolean;
    onDraftChange: (content: string) => void;
    onSave: (id: string, patch: TaskDetailPatch) => void;
  }) => ReactNode;
}) {
  // `null` = the body has not moved. Any reported change counts as pending:
  // the editor reports the document, not a diff, so "typed it back exactly"
  // is not a distinction it can make cheaply.
  const [content, setContent] = useState<string | null>(null);
  return children({
    dirty: content !== null,
    onDraftChange: setContent,
    onSave: (id, patch) => {
      onSave(id, patch, content ?? undefined);
      setContent(null);
    },
  });
}

export interface KanbanViewProps {
  /**
   * Shell "new task" intent (global:new-task). When it flips true the board
   * opens its add dialog (create-and-focus) and calls onConsumeNewTask to clear
   * the flag — so returning to the Tasks tab later never re-opens it.
   */
  pendingNewTask?: boolean;
  onConsumeNewTask?: () => void;
  /**
   * A task to open, arrived from a "[[" link click in another tab (#370).
   * Same idiom as pendingNewTask: consume it once, so returning to the Tasks
   * tab later never re-opens the same task over the user's own selection.
   */
  pendingSelectTaskId?: string | null;
  onConsumePendingSelect?: () => void;
  /**
   * Injected for the "[[" link-target pool (#507). The pool spans notes +
   * dailies + tasks, and the Todo tab mounts none of those Providers but its
   * own, so the lists come off the DataService (§3.1) exactly as they do for
   * Notes / Daily. Link features are off when it is absent.
   */
  dataService?: DataService;
  /** Navigate to a link target (MainScreen owns section + tab switching). */
  onNavigateToItem?: (target: { id: string; role: string }) => void;
}

export function KanbanView({
  pendingNewTask = false,
  onConsumeNewTask,
  pendingSelectTaskId = null,
  onConsumePendingSelect,
  dataService,
  onNavigateToItem,
}: KanbanViewProps = {}): React.JSX.Element {
  const tree = useTaskTreeContext();
  const wikiTags = useWikiTagsUnifiedContext();
  const { allTags, getTagsForItem, setTagColor } = wikiTags;
  const { t } = useTranslation();
  // Desktop (wide) = the full DnD board + rightSidebar detail; Mobile (narrow)
  // = the stripped-down MobileTaskList (brief). Same 768px breakpoint the
  // AppShell uses (its own read — useMediaQuery is a pure display hook).
  const isWide = useMediaQuery(WIDE_QUERY, true);
  const rightSidebar = useRightSidebarContext();
  // "[[" wiring for the task body (#507). Both surfaces below render through
  // renderTaskDetail, so wide and the mobile sheet get it from one place.
  const { loadLinkTargets, handleResolvedLinkInserted, handleBodySaved } =
    useTaskLinking({
      dataService,
    });
  const [viewMode, setViewMode] = useState<KanbanViewMode>(() =>
    readKanbanViewMode("tag"),
  );
  const [moveError, setMoveError] = useState<string | null>(null);

  /*
   * One press of the panel's save button (#713): the title patch the panel
   * sends, plus whatever the body editor had been holding (undefined when the
   * body never moved). ONE update carrying both halves — two writes would race
   * each other through the same row, and the loser would revert the winner.
   */
  const saveTaskDetail = useCallback(
    (id: string, patch: TaskDetailPatch, content?: string) => {
      tree.updateNode(id, {
        ...patch,
        ...(content !== undefined ? { content } : {}),
      });
      if (content === undefined) return;
      // #372: drop inline-origin edges whose "[[ ]]" left the text. It used to
      // ride the editor's own 800ms flush; the press is where the body lands
      // now, so it rides that instead.
      handleBodySaved(id, content);
    },
    [tree, handleBodySaved],
  );

  /*
   * #736: since the press became the only commit, walking away from the detail
   * is a DISCARD — so it has to be asked about. `onDirtyChange` had been on the
   * panel since #628's contract but no host read it, which is exactly how a
   * typed title could vanish without a word.
   *
   * The question is the in-app <ConfirmDialog> (#707), never `window.confirm`:
   * the native one lands outside the theme and freezes the page hard enough to
   * stall Playwright. Its answer arrives a tick later, hence `decideUnsavedClose`
   * — a guard that read the pending promise as a truthy "yes" would throw the
   * draft away the moment the dialog opened.
   *
   * The flag is deliberately NOT cleared on an agreed discard: the panel owns
   * it and re-reports `false` as it unmounts, so clearing here could only ever
   * be wrong. The convert path below asks its own question afterwards, and a
   * refusal there leaves the draft on screen — with a flag already wiped, the
   * NEXT exit would discard it in silence, having just promised not to.
   */
  const {
    request: confirmRequest,
    ask: askConfirm,
    resolve: resolveConfirm,
  } = useConfirmDialog();
  const detailDirtyRef = useRef(false);
  /*
   * #753: the same pending draft, declared to the SHELL. The exits above are
   * the ones this view can see; closing the right sidebar and switching
   * sections are not — both remove the container, and the panel just stops
   * existing. The probe is the same ref read live, so a refused discard leaves
   * it pending and the next attempt asks again (nothing is cached up there
   * either — the reason #745's hosts could not apply `clearDirty`).
   */
  useUnsavedDraft(useCallback(() => detailDirtyRef.current, []));
  const requestDetailClose = useCallback(
    async (proceed: () => void) => {
      const decision = await decideUnsavedClose({
        dirty: detailDirtyRef.current,
        askDiscard: () =>
          askConfirm({
            message: t("common.unsavedCloseConfirm"),
            confirmLabel: t("common.discard"),
            cancelLabel: t("common.cancel"),
            // Throwing away typed-in work is the destructive answer here, even
            // though nothing is deleted from the database.
            danger: true,
          }),
      });
      if (decision.close) proceed();
    },
    [askConfirm, t],
  );

  /*
   * Which task's detail is open, and how it got there (#470) — a narrow card
   * tap, a "[[" link landing from another tab, a wide↔narrow crossing, or a
   * task deleted underneath the sheet. Extracted so those transitions can be
   * tested without mounting the board and its providers (see the hook).
   */
  const detail = useTaskDetailTarget({
    isWide,
    nodeMap: tree.nodeMap,
    isLoading: tree.isLoading,
    pendingSelectTaskId,
    onSelect: tree.setSelectedTaskId,
    onOpenWide: rightSidebar.open,
    onConsumePendingSelect,
  });

  /*
   * #625: "予定に変換" — the board's half of the Event <-> Todo pair.
   *
   * The write re-roles the row (id kept), so the task simply leaves this board
   * and appears on the calendar. `refetch` is what makes that visible here:
   * the conversion goes through the DataService, not through this provider's
   * own persist path, so nothing else tells the tree its row is gone.
   *
   * A todo WITH CHILDREN is refused (D-20260810-sched-4) — 0009's composite FK
   * (parent_item_id, parent_item_role='task') would reject the role change
   * anyway, and a sentence beats an FK error. The guard is per-id and claimed
   * synchronously (#434): confirm + async write is exactly the window a second
   * click lands in.
   *
   * A failure lands in the board's own alert banner (`moveError`) rather than a
   * toast: it is the failure surface this screen already has, it auto-dismisses
   * on the same 4s timer, and it keeps the board renderable without the shell's
   * Toast Provider — which is how every test here mounts it. On narrow the
   * sheet is closed first, because the banner sits UNDER it and a message the
   * user cannot see is the same as no message at all.
   *
   * Declared after `detail` on purpose: the narrow branch needs closeSheet, and
   * a dependency array naming a `const` declared further down throws at render.
   */
  const { begin: beginConvert, end: endConvert } = useInFlightGuard();
  const handleConvertToEvent = useCallback(
    (task: TaskNode) => {
      if (!dataService) return;
      const blocked = todoToEventBlock(tree.nodes, task.id);
      if (blocked) {
        window.alert(
          t("itemConvert.childrenBlocked", {
            title: blocked.title,
            count: blocked.childCount,
          }),
        );
        return;
      }
      if (
        !window.confirm(
          // A child Todo loses its parent link (events have no hierarchy), and
          // the dialog is the only place that can say so before it happens.
          t(
            task.parentId != null
              ? "itemConvert.toEventConfirmChild"
              : "itemConvert.toEventConfirm",
            { title: task.title || t("common.untitled") },
          ),
        )
      )
        return;
      if (!beginConvert(task.id)) return;
      void dataService
        .convertTaskToEvent(
          task.id,
          taskToEventPlacement(task, todayCalendarKey()),
        )
        .then(() => {
          // The detail panel is showing a row that is no longer a task; the
          // refetch drops it from the tree and the selection resolves to null.
          tree.setSelectedTaskId(null);
          void tree.refetch();
        })
        .catch((err) => {
          logServiceError(
            "ItemConversion",
            `convertTaskToEvent (${task.id})`,
            err,
          );
          // The DB sees children the live tree cannot (trashed ones still hold
          // the 0009 FK), so that refusal gets its own sentence — "conversion
          // failed" would send the user looking for a network problem.
          detail.closeSheet();
          setMoveError(
            err instanceof ItemConversionError && err.reason === "children"
              ? t("itemConvert.childrenBlockedServer")
              : t("itemConvert.failed"),
          );
        })
        .finally(() => endConvert(task.id));
    },
    [dataService, tree, detail, t, beginConvert, endConvert],
  );

  /*
   * #736: the detail's own convert button, guarded. Declared here rather than
   * inline in `renderTaskDetail` because that helper runs during render, and a
   * ref read reached from there is what react-hooks/refs rejects — the guard
   * has to be entered from a stable callback.
   */
  const handleConvertFromDetail = useCallback(
    (task: TaskNode) => {
      void requestDetailClose(() => handleConvertToEvent(task));
    },
    [requestDetailClose, handleConvertToEvent],
  );

  /*
   * #786: delete the todo the detail is showing — the board's missing exit.
   * Every other surface could remove a todo (the Schedule tray, the day-view
   * chip, and #775's detail panel next door); the Tasks board could only ever
   * add one, on Desktop AND in the narrow sheet, which #775 left behind because
   * this host never passed `onDelete`.
   *
   * The question is the in-app <ConfirmDialog> (#707), never `window.confirm`,
   * and it is asked whatever the row is: the sheet is reached by a deliberate
   * tap, but a phone has no hover to reveal what a control does and no keyboard
   * undo behind it. A parent row gets the cascade sentence instead — the count
   * is the one thing the user cannot see from here, and the shared guard is
   * what keeps that number identical to the Schedule side's.
   *
   * Closed BEFORE the write, and deliberately NOT through `requestDetailClose`:
   * a pending title on a row being deleted is not something to rescue, and
   * asking twice for one act reads as a bug. The selection is cleared here as
   * well as inside softDelete — the panel is this host's surface, so what makes
   * it disappear should be visible in this host, not an internal of the tree
   * hook. Undo is the same one every other delete raises
   * (softDelete → persistWithHistory), with Trash as the route that outlives
   * the section.
   */
  const handleDeleteFromDetail = useCallback(
    (id: string) => {
      void confirmTodoDetailDelete(tree.nodes, id, askConfirm, {
        confirm: (name) => t("scheduleScreen.todoDeleteConfirm", { name }),
        cascadeConfirm: (name, count) =>
          t("scheduleScreen.todoDeleteCascadeConfirm", { name, count }),
        untitled: t("common.untitled"),
        confirmLabel: t("scheduleScreen.delete"),
        cancelLabel: t("common.cancel"),
      }).then((ok) => {
        if (!ok) return;
        detail.closeSheet();
        tree.setSelectedTaskId(null);
        tree.softDelete(id);
      });
    },
    [tree, detail, askConfirm, t],
  );

  // Board-only layout (list mode retired): the rightSidebar hosts the selected
  // task's detail, opened on card-click. Crossing wide→narrow, the detail moves
  // into the narrow layout but rightSidebar.isOpen persists — leaving the mobile
  // Details drawer overlay covering the screen — so close it. This effect only
  // fires on the isWide transition, not on a bare open() from the shell.
  useEffect(() => {
    if (!isWide) rightSidebar.close();
    // rightSidebar.close is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWide]);

  // Desktop board card click → select + push the detail into the rightSidebar
  // panel (auto-open). Narrow uses the BottomSheet inside MobileTaskList, so
  // this handler is the wide-board path only.
  const handleSelectCard = useCallback(
    (id: string) => {
      tree.setSelectedTaskId(id);
      rightSidebar.open();
    },
    [tree, rightSidebar],
  );

  // Add-task dialog (W-UX). The board had no create entry point; this small
  // centered overlay creates a task, then opens it straight into the detail
  // modal.
  //
  // The shell's global:new-task intent (pendingNewTask) opens this dialog on
  // the wide board (TaskAddDialog auto-focuses its title input and creates the
  // task on submit via the TaskTree provider) — the app's own create-and-focus
  // entry. Two entry timings: a fresh mount already carrying the flag (user
  // came from another section) → the lazy initializer; a flip while already on
  // the Tasks tab → the guarded during-render tracker below. Both derive state
  // from the prop WITHOUT a synchronous setState inside an effect (which would
  // cascade — react-hooks/set-state-in-effect); this is React's "adjust state
  // while rendering" pattern. Narrow relies on the MobileTaskList quick-add.
  const [addOpen, setAddOpen] = useState(() => pendingNewTask && isWide);
  const [prevPendingNewTask, setPrevPendingNewTask] = useState(pendingNewTask);
  if (pendingNewTask !== prevPendingNewTask) {
    setPrevPendingNewTask(pendingNewTask);
    if (pendingNewTask && isWide) setAddOpen(true);
  }

  // Clear the shell flag once it has been observed so returning to the Tasks
  // tab later never re-opens the dialog. onConsumeNewTask is an opaque parent
  // callback (not a local setState), so it is safe in an effect.
  useEffect(() => {
    if (pendingNewTask) onConsumeNewTask?.();
  }, [pendingNewTask, onConsumeNewTask]);

  const handleAddSubmit = useCallback(
    (input: { type: TaskAddType; title: string; parentId: string | null }) => {
      const node = tree.addNode(input.type, input.parentId, input.title);
      setAddOpen(false);
      tree.setSelectedTaskId(node.id);
    },
    [tree],
  );

  // The host owns viewMode (it drives column building), so the board runs
  // controlled and its own persistence is inert. Persist here instead, sharing
  // one storage key with the board via the shared helper — the chosen view
  // then survives reloads.
  const handleViewModeChange = useCallback((mode: KanbanViewMode) => {
    setViewMode(mode);
    persistKanbanViewMode(mode);
  }, []);

  // Auto-dismiss the rejection alert so it doesn't linger past the next action.
  useEffect(() => {
    if (!moveError) return;
    const id = setTimeout(() => setMoveError(null), 4000);
    return () => clearTimeout(id);
  }, [moveError]);

  const labels = useMemo<KanbanLabels>(
    () => ({
      viewStatus: t("kanban.viewStatus"),
      viewTag: t("kanban.viewTag"),
      segmentedGroupLabel: t("kanban.segmentedGroupLabel"),
      statusNotStarted: t("taskDetail.statusNotStarted"),
      statusInProgress: t("taskDetail.statusInProgress"),
      statusDone: t("taskDetail.statusDone"),
      cardAriaLabel: (title, statusText) => `${title} — ${statusText}`,
      emptyColumn: t("kanban.emptyColumn"),
      placeholderHint: t("kanban.placeholderHint"),
      countAriaLabel: (n) => t("materials.tasks.taskCount", { count: n }),
      untagged: t("kanban.untagged"),
      colorPickerLabel: t("kanban.colorPickerLabel"),
      colorClearLabel: t("kanban.colorClearLabel"),
      colorCustomLabel: t("kanban.colorCustomLabel"),
    }),
    [t],
  );

  // Resolve each active task's tags (taskId → tags) + the ordered tag list,
  // from the WikiTags master + cached assignments. Pure shapes for the
  // builders (the shared package never reaches the tag context).
  const { tags, tagsByTask } = useMemo(() => {
    const tagById = new Map<string, KanbanCardTag>();
    const list: KanbanCardTag[] = allTags.map((tag) => {
      const model: KanbanCardTag = {
        id: tag.id,
        name: tag.name,
        color: tag.color ?? undefined,
      };
      tagById.set(tag.id, model);
      return model;
    });
    const byTask = new Map<string, KanbanCardTag[]>();
    for (const node of tree.nodes) {
      if (node.type !== "task" || node.isDeleted) continue;
      const resolved: KanbanCardTag[] = [];
      for (const a of getTagsForItem(node.id)) {
        if (a.isDeleted) continue;
        const tag = tagById.get(a.tagId);
        if (tag) resolved.push(tag);
      }
      if (resolved.length > 0) byTask.set(node.id, resolved);
    }
    return { tags: list, tagsByTask: byTask };
  }, [tree.nodes, allTags, getTagsForItem]);

  // Build only the active view's columns.
  const columns = useMemo<KanbanColumnModel[]>(() => {
    switch (viewMode) {
      case "status":
        return buildStatusColumns(tree.nodes, labels, tagsByTask);
      case "tag":
        return buildTagColumns(tree.nodes, tags, tagsByTask, labels);
    }
  }, [viewMode, tree.nodes, labels, tags, tagsByTask]);

  // The three status columns for the Mobile list (cards already carry the
  // tag chips via the pure builder). Built regardless of the desktop
  // viewMode so switching wide↔narrow needs no extra plumbing.
  const statusColumns = useMemo<KanbanColumnModel[]>(
    () => buildStatusColumns(tree.nodes, labels, tagsByTask),
    [tree.nodes, labels, tagsByTask],
  );

  // Persist a tag column's color change. The shared column reports its id; the
  // host maps it back to a tag (the tag view is the only color-editable view).
  const handleColorChange = useCallback(
    (columnId: string, color: string | null) => {
      if (viewMode !== "tag") return;
      if (columnId === "tag-__none__") return;
      const tagId = columnId.startsWith("tag-") ? columnId.slice(4) : columnId;
      void setTagColor(tagId, color).catch(() => {
        setMoveError("Failed to update tag color");
      });
    },
    [viewMode, setTagColor],
  );

  const dnd = useKanbanDnd({
    viewMode,
    columns,
    setTaskStatus: tree.setTaskStatus,
  });

  // The card currently being dragged, for the DragOverlay ghost.
  const activeCard = useMemo<KanbanCardModel | null>(() => {
    if (!dnd.activeCardId) return null;
    for (const col of columns) {
      const found = col.cards.find((c) => c.id === dnd.activeCardId);
      if (found) return found;
    }
    return null;
  }, [dnd.activeCardId, columns]);

  if (tree.isLoading) {
    // Same-shape skeleton (brief §3 — never a spinner).
    return (
      <div className="px-4 pt-4">
        <SkeletonList rows={5} rowHeight={64} gap={10} />
      </div>
    );
  }

  // "+ Add" entry point in the board toolbar — opens the add dialog. Accent
  // pill (mock): Plus 14 + 13px medium label, 8px radius.
  const addButton = (
    <button
      type="button"
      onClick={() => setAddOpen(true)}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-lumen-accent px-3.5 py-1.5 text-[0.8125rem] font-medium text-lumen-on-accent shadow-lumen-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
    >
      <Plus size={14} aria-hidden />
      {t("kanban.addTask")}
    </button>
  );

  // Board toolbar trailing actions: "+ Add" (list mode retired — the board is
  // the Tasks view).
  const boardHeaderActions = (
    <div className="flex items-center gap-2">{addButton}</div>
  );

  // Tag view (read-only DnD) → plain board; status view → DnD board.
  const board = !dnd.enabled ? (
    <KanbanBoard
      columns={columns}
      labels={labels}
      viewMode={viewMode}
      onViewModeChange={handleViewModeChange}
      onSelectCard={handleSelectCard}
      onColorChange={handleColorChange}
      headerActions={boardHeaderActions}
    />
  ) : (
    <DndContext
      sensors={dnd.sensors}
      collisionDetection={closestCorners}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={dnd.handleDragStart}
      onDragEnd={dnd.handleDragEnd}
      onDragCancel={dnd.handleDragCancel}
    >
      <KanbanBoard
        columns={columns}
        labels={labels}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onSelectCard={handleSelectCard}
        onColorChange={handleColorChange}
        headerActions={boardHeaderActions}
        renderColumn={({ column, showTags, fluidWidth }) => (
          <KanbanColumnDroppable
            column={column}
            labels={labels}
            showTags={showTags}
            fluidWidth={fluidWidth}
            onSelectCard={handleSelectCard}
            onColorChange={handleColorChange}
          />
        )}
        overlay={
          <DragOverlay>
            {activeCard ? (
              <div className="w-[316px] px-2.5">
                <KanbanCard
                  card={activeCard}
                  labels={labels}
                  showTags={viewMode !== "tag"}
                  onSelect={() => undefined}
                />
              </div>
            ) : null}
          </DragOverlay>
        }
      />
    </DndContext>
  );

  // K3 (target-IA) — the selected task's detail now lives in the shared
  // rightSidebar panel (Desktop) instead of a centered modal. narrow shows the
  // same panel inside the MobileTaskList sheet (#470), so the portal is
  // wide-only.
  const selected = tree.selectedTask;

  /*
   * One panel, two surfaces. Everything except the status control is identical,
   * so building it once keeps a field added to the task detail from reaching
   * only one width.
   *
   * Tag row (#412 Phase 1). Was a read-only chip list built here from
   * tagsByTask; it is now the same <TagPicker> the note detail uses, so a task
   * can gain and lose tags from the surface the user is already reading. The
   * picker owns its own row caption (the shared kind badge, itemRole="task"),
   * which is why no `tagsLabel` is passed: TaskDetailPanel's generic "TAGS"
   * caption plus the badge would say the same thing twice.
   *
   * Always rendered (not conditional on the task having tags): an empty row is
   * the only place the "+ Tag" affordance can live, and without it a task with
   * no tags would have no route to its first one.
   */
  const renderTaskDetail = (task: TaskNode, statusControl?: ReactNode) => (
    // #625: the convert action sits BELOW the panel rather than inside it, so
    // TaskDetailPanel (shared, and rendered by Schedule too) keeps its current
    // shape. Same wrapper the Schedule task overlay uses for its own button.
    <div className="flex flex-col gap-3">
      {/* Keyed on the task: the body draft below belongs to the task it was
          typed against, and to this opening of it. */}
      <TaskBodyDraft key={task.id} onSave={saveTaskDetail}>
        {(draft) => (
          <TaskDetailPanel
            taskId={task.id}
            title={task.title}
            status={task.status}
            onSave={draft.onSave}
            contentDirty={draft.dirty}
            // #736: title AND body, since `contentDirty` is folded in before
            // the panel reports. A ref rather than state — nothing on screen
            // depends on it, and re-rendering every column on each keystroke
            // would be a steep price for a flag only handlers read.
            onDirtyChange={(dirty) => {
              detailDirtyRef.current = dirty;
            }}
            onToggleStatus={tree.toggleTaskStatus}
            // #786: fires RAW — the confirm, the close and the write all live
            // in the host (see handleDeleteFromDetail). Paired with
            // `deleteLabel`; the shared panel draws the row only when both are
            // present, so this is the one place either surface gains a delete.
            onDelete={handleDeleteFromDetail}
            deleteLabel={t("scheduleScreen.todoDelete")}
            statusControl={statusControl}
            titleLabel={t("taskDetail.titleLabel")}
            statusLabel={t("taskDetail.status")}
            statusText={t(STATUS_TEXT_KEY[task.status ?? "NOT_STARTED"])}
            contentLabel={t("taskDetail.content")}
            saveLabel={t("taskDetail.save")}
            savedLabel={t("taskDetail.saved")}
            unsavedLabel={t("taskDetail.unsaved")}
            tagsSlot={
              <TagPicker itemId={task.id} itemRole="task" showLabel size="sm" />
            }
            contentEditor={
              <RichTextEditor
                noteId={task.id}
                initialContent={task.content || undefined}
                // #713: draft, not auto-save. `onDraftChange` (instead of
                // `onUpdate`) switches this ONE editor off its 800ms debounce
                // and its unmount flush — Notes and Daily keep both. The
                // content is parked in TaskBodyDraft and written by the press.
                onDraftChange={draft.onDraftChange}
                // "[[" autocomplete + click navigation (#507). Same three props
                // the Notes and Daily editors take; this editor simply never
                // got them, so the menu never opened and a resolved link was
                // inert. No create-note row — like Daily, a task body links to
                // EXISTING items.
                loadLinkTargets={loadLinkTargets}
                onNavigateToItem={onNavigateToItem}
                onResolvedLinkInserted={(targetId) =>
                  handleResolvedLinkInserted(task.id, targetId)
                }
              />
            }
          />
        )}
      </TaskBodyDraft>
      {dataService && (
        // #736: the conversion clears the selection, which unmounts this whole
        // subtree — draft included. Before #713 the blur flush had already
        // written the new title, so it rode along; now it has to be asked about
        // first, or the user watches their typing disappear into an event.
        <button
          type="button"
          onClick={() => handleConvertFromDetail(task)}
          className="self-start rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
        >
          {t("itemConvert.toEvent")}
        </button>
      )}
    </div>
  );

  // Desktop: the selected task's detail, pushed into the rightSidebar on
  // card-click. Null when nothing is selected — and on narrow, where only the
  // sheet below shows a detail (the portal is wide-only, so building this there
  // would just construct a TagPicker and an editor element to throw away).
  const taskDetail = isWide && selected ? renderTaskDetail(selected) : null;

  // Mobile: the same panel in the bottom sheet, with the touch status row
  // instead of the Desktop cycle button (#470).
  const sheetTask = detail.sheetTask;
  const mobileTaskDetail = sheetTask
    ? renderTaskDetail(
        sheetTask,
        <TaskStatusChoices
          value={sheetTask.status ?? "NOT_STARTED"}
          onChange={(status) => tree.setTaskStatus(sheetTask.id, status)}
          labels={labels}
          label={t("materials.tasks.statusGroupLabel")}
        />,
      )
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {moveError && (
        <p
          role="alert"
          className="mx-2 mt-2 rounded-md border border-lumen-danger px-3 py-2 text-sm text-lumen-danger"
        >
          {moveError}
        </p>
      )}

      {isWide ? (
        // BOARD — full-width DnD board (the Tasks view; list mode retired).
        // The board's own toolbar hosts the grouping switch + headerActions (Add).
        <div className="flex min-h-0 flex-1 flex-col px-lumen-gutter pt-4 md:px-lumen-gutter-wide">
          {columns.length === 0 ? (
            <EmptyState
              icon={<ListTodo aria-hidden />}
              message={t("materials.tasks.empty")}
              cta={{
                label: t("materials.tasks.addCta"),
                onClick: () => setAddOpen(true),
              }}
            />
          ) : (
            board
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <MobileTaskList
            statusColumns={statusColumns}
            cardLabels={labels}
            labels={{
              statusNotStarted: t("taskDetail.statusNotStarted"),
              statusInProgress: t("taskDetail.statusInProgress"),
              statusDone: t("taskDetail.statusDone"),
              filterLabel: t("materials.tasks.filterLabel"),
              detailTitle: t("materials.tasks.detailTitle"),
              close: t("common.close"),
              empty: t("materials.tasks.empty"),
              addCta: t("materials.tasks.addCta"),
              quickAddTitle: t("materials.tasks.quickAddTitle"),
              quickAddPlaceholder: t("materials.tasks.quickAddPlaceholder"),
              quickAddSubmit: t("materials.tasks.quickAddSubmit"),
            }}
            onQuickAdd={(title) => tree.addNode("task", null, title)}
            detailTaskId={sheetTask ? sheetTask.id : null}
            onSelectTask={detail.openSheet}
            // #736: the sheet funnels Escape, the backdrop and its close button
            // into this one callback, so guarding it covers every narrow exit.
            onCloseDetail={() => {
              void requestDetailClose(detail.closeSheet);
            }}
            detail={mobileTaskDetail}
          />
        </div>
      )}

      {/* Desktop rightSidebar content (wide-only, so narrow never fills the
          MobileDrawer): the selected task's detail. The portal renders nothing
          until a card-click both selects and opens the panel. */}
      {isWide && selected && (
        <RightSidebarPortal>{taskDetail}</RightSidebarPortal>
      )}

      {isWide && (
        <TaskAddDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSubmit={handleAddSubmit}
          labels={{
            title: t("kanban.addDialogTitle"),
            titleLabel: t("kanban.addTitleLabel"),
            titlePlaceholder: t("kanban.addTitlePlaceholder"),
            submit: t("kanban.addSubmit"),
            cancel: t("kanban.addCancel"),
          }}
        />
      )}

      {/* Mounted last so it portals ABOVE the surface it is asked from — the
          discard question has to sit on top of the detail it is about (#707),
          and on narrow that means over the sheet. It holds no place in the tree
          while nothing is being asked. */}
      {confirmRequest && (
        <ConfirmDialog
          open
          message={confirmRequest.message}
          confirmLabel={confirmRequest.confirmLabel}
          cancelLabel={confirmRequest.cancelLabel}
          danger={confirmRequest.danger}
          onConfirm={() => resolveConfirm(true)}
          onCancel={() => resolveConfirm(false)}
        />
      )}
    </div>
  );
}
