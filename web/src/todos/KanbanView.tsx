import { useCallback, useEffect, useState } from "react";
import { ListTodo } from "lucide-react";
import {
  ConfirmDialog,
  EmptyState,
  SkeletonList,
  RightSidebarPortal,
  TodoStatusChoices,
  TodoAddDialog,
  useMediaQuery,
  useRightSidebarContext,
  useTodoTreeContext,
  useWikiTagsUnifiedContext,
  useTranslation,
  readKanbanViewMode,
  persistKanbanViewMode,
  tourAnchor,
  useTourAction,
  TOUR_ACTIONS,
  TOUR_ANCHORS,
  type DataService,
  type KanbanViewMode,
  type TodoDetailPatch,
  type TodoStatus,
  WIDE_QUERY,
} from "@life-editor/shared";
import { useKanbanDnd } from "./useKanbanDnd";
import { useKanbanColumns } from "./useKanbanColumns";
import { useTodoDetailActions } from "./useTodoDetailActions";
import { useTodoDetailTarget } from "./useTodoDetailTarget";
import { useTodoAddDialog } from "./useTodoAddDialog";
import { useTodoLinking } from "./hooks/useTodoLinking";
import { KanbanBoardSurface } from "./KanbanBoardSurface";
import { MobileTodoList } from "./MobileTodoList";
import { TodoDetailContent } from "./TodoDetailContent";

/*
 * Web Todos Kanban host (K1 + K-DnD + K2 + K3). Replaces the tree in the
 * Todos section. Owns the data + i18n wiring; the shared <KanbanBoard> and
 * its children stay pure (§6.4):
 *
 *   - data: useTodoTreeContext() → nodes / status mutations;
 *     useWikiTagsUnifiedContext() → tag master + assignments + tag color.
 *   - i18n: useTranslation() → a KanbanLabels object injected as props.
 *
 * #896 split this file at its seams — what it keeps is the wiring, and the four
 * pieces it wires together live next door:
 *
 *   - useKanbanColumns  — the labels + the three column models (K1 / K2)
 *   - KanbanBoardSurface — the toolbar and the plain / DnD board (K-DnD)
 *   - TodoDetailContent — the detail panel both widths open (K3)
 *   - useTodoDetailActions — its exits, and the questions each one asks
 *
 * K3: clicking a card opens the selected todo in the right sidebar via
 * <RightSidebarPortal>. On narrow the same panel opens in the MobileTodoList
 * bottom sheet (#470 — mobile-scope.md #6 Phase 2), with the touch status row
 * swapped in for the cycle button. DnD and the column operations stay
 * Desktop-only.
 *
 * Layout: the full-width board is the Todos view (the old list mode was retired
 * 2026-07-18 — Board only). The grouping axis (viewMode: status / tag) lives in
 * the board's own switch and is persisted here (persistKanbanViewMode), because
 * the host is what builds the columns from it.
 */

export interface KanbanViewProps {
  /**
   * Shell "new todo" intent (global:new-task). When it flips true the board
   * opens its add dialog (create-and-focus) and calls onConsumeNewTodo to clear
   * the flag — so returning to the Todos tab later never re-opens it.
   */
  pendingNewTodo?: boolean;
  onConsumeNewTodo?: () => void;
  /**
   * A todo to open, arrived from a "[[" link click in another tab (#370).
   * Same idiom as pendingNewTodo: consume it once, so returning to the Todos
   * tab later never re-opens the same todo over the user's own selection.
   */
  pendingSelectTodoId?: string | null;
  onConsumePendingSelect?: () => void;
  /**
   * Injected for the "[[" link-target pool (#507). The pool spans notes +
   * dailies + todos, and the Todo tab mounts none of those Providers but its
   * own, so the lists come off the DataService (§3.1) exactly as they do for
   * Notes / Daily. Link features are off when it is absent.
   */
  dataService?: DataService;
  /** Navigate to a link target (MainScreen owns section + tab switching). */
  onNavigateToItem?: (target: { id: string; role: string }) => void;
}

export function KanbanView({
  pendingNewTodo = false,
  onConsumeNewTodo,
  pendingSelectTodoId = null,
  onConsumePendingSelect,
  dataService,
  onNavigateToItem,
}: KanbanViewProps = {}): React.JSX.Element {
  const tree = useTodoTreeContext();
  const { setTagColor } = useWikiTagsUnifiedContext();
  const { t } = useTranslation();
  // Desktop (wide) = the full DnD board + rightSidebar detail; Mobile (narrow)
  // = the stripped-down MobileTodoList (brief). Same 768px breakpoint the
  // AppShell uses (its own read — useMediaQuery is a pure display hook).
  const isWide = useMediaQuery(WIDE_QUERY, true);
  const rightSidebar = useRightSidebarContext();
  // "[[" wiring for the todo body (#507). Both surfaces below render through
  // TodoDetailContent, so wide and the mobile sheet get it from one place.
  const { loadLinkTargets, handleResolvedLinkInserted, handleBodySaved } =
    useTodoLinking({ dataService });
  const [viewMode, setViewMode] = useState<KanbanViewMode>(() =>
    readKanbanViewMode("tag"),
  );

  const { labels, columns, statusColumns } = useKanbanColumns({
    nodes: tree.nodes,
    viewMode,
  });

  /*
   * Which todo's detail is open, and how it got there (#470) — a narrow card
   * tap, a "[[" link landing from another tab, a wide↔narrow crossing, or a
   * todo deleted underneath the sheet. Extracted so those transitions can be
   * tested without mounting the board and its providers (see the hook).
   */
  const detail = useTodoDetailTarget({
    isWide,
    nodeMap: tree.nodeMap,
    isLoading: tree.isLoading,
    pendingSelectTodoId,
    onSelect: tree.setSelectedTodoId,
    onOpenWide: rightSidebar.open,
    onConsumePendingSelect,
  });

  const {
    moveError,
    setMoveError,
    confirmRequest,
    resolveConfirm,
    detailDirtyRef,
    requestDetailClose,
    handleConvertFromDetail,
    handleDeleteFromDetail,
  } = useTodoDetailActions({
    tree,
    detail,
    isWide,
    rightSidebar,
    dataService,
  });

  /*
   * One press of the panel's save button (#713): the title patch the panel
   * sends, plus whatever the body editor had been holding (undefined when the
   * body never moved). ONE update carrying both halves — two writes would race
   * each other through the same row, and the loser would revert the winner.
   */
  const saveTodoDetail = useCallback(
    (id: string, patch: TodoDetailPatch, content?: string) => {
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

  // Board-only layout (list mode retired): the rightSidebar hosts the selected
  // todo's detail, opened on card-click. Crossing wide→narrow, the detail moves
  // into the narrow layout but rightSidebar.isOpen persists — leaving the mobile
  // Details drawer overlay covering the screen — so close it. This effect only
  // fires on the isWide transition, not on a bare open() from the shell.
  useEffect(() => {
    if (!isWide) rightSidebar.close();
    // rightSidebar.close is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWide]);

  // Desktop board card click → select + push the detail into the rightSidebar
  // panel (auto-open). Narrow uses the BottomSheet inside MobileTodoList, so
  // this handler is the wide-board path only.
  // Depend on the two members, not the whole context objects: `tree` is a new
  // object on every todo mutation and `rightSidebar` churns on every resize
  // sample, either of which would hand the whole board a fresh onSelectCard.
  // Both members are themselves useCallbacks.
  const setSelectedTodoId = tree.setSelectedTodoId;
  const openSidebar = rightSidebar.open;
  const handleSelectCard = useCallback(
    (id: string) => {
      setSelectedTodoId(id);
      openSidebar();
    },
    [setSelectedTodoId, openSidebar],
  );

  // Add-todo dialog (W-UX) + the shell's global:new-task intent.
  const { addOpen, openAdd, setAddOpen, handleAddSubmit } = useTodoAddDialog({
    tree,
    isWide,
    pendingNewTodo,
    onConsumeNewTodo,
  });

  /*
   * Tutorial tour reporting (#1124). Three of the Schedule steps live on this
   * screen, and each one waits for the write rather than the click.
   *
   * "The Todo sheet is open" is reported ON MOUNT, because this component
   * mounts exactly when the tab does — which covers every route in (the tab
   * band, the tray title, the `nav:tasks` shortcut, the palette) without any
   * of them knowing about the tour. Known gap: a user ALREADY on this tab when
   * the step becomes current gets no mount, so the step waits until they leave
   * and come back. Reachable only by restarting the tour from Settings while
   * sitting on the board — `scheduleTab` is not persisted, so a reload always
   * lands on Calendar.
   */
  const reportTourAction = useTourAction();
  useEffect(() => {
    reportTourAction(TOUR_ACTIONS.scheduleTodoTabOpened);
  }, [reportTourAction]);

  // Members off `tree` are pulled out so the wrappers below depend on the
  // functions rather than on the whole context value (the same reason
  // handleSelectCard does it above).
  const nodeMap = tree.nodeMap;
  const toggleTodoStatus = tree.toggleTodoStatus;
  const setTodoStatus = tree.setTodoStatus;

  const handleAddSubmitReported = useCallback<typeof handleAddSubmit>(
    (input) => {
      handleAddSubmit(input);
      reportTourAction(TOUR_ACTIONS.scheduleTodoCreated);
    },
    [handleAddSubmit, reportTourAction],
  );

  const handleToggleStatusReported = useCallback(
    (id: string) => {
      // Read the status BEFORE the flip: only finishing a todo advances the
      // step, and re-opening one must not. Two values since #873, so "not
      // DONE" is the whole test.
      const completes = (nodeMap.get(id)?.status ?? "NOT_STARTED") !== "DONE";
      toggleTodoStatus(id);
      if (completes) reportTourAction(TOUR_ACTIONS.scheduleTodoCompleted);
    },
    [nodeMap, reportTourAction, toggleTodoStatus],
  );

  const handleSetTodoStatusReported = useCallback(
    (id: string, status: TodoStatus) => {
      setTodoStatus(id, status);
      if (status === "DONE") {
        reportTourAction(TOUR_ACTIONS.scheduleTodoCompleted);
      }
    },
    [reportTourAction, setTodoStatus],
  );

  // The host owns viewMode (it drives column building), so the board runs
  // controlled and its own persistence is inert. Persist here instead, sharing
  // one storage key with the board via the shared helper — the chosen view
  // then survives reloads.
  const handleViewModeChange = useCallback((mode: KanbanViewMode) => {
    setViewMode(mode);
    persistKanbanViewMode(mode);
  }, []);

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
    [viewMode, setTagColor, setMoveError],
  );

  const dnd = useKanbanDnd({
    viewMode,
    columns,
    setTodoStatus: handleSetTodoStatusReported,
  });

  if (tree.isLoading) {
    // Same-shape skeleton (brief §3 — never a spinner).
    return (
      <div className="px-4 pt-4">
        <SkeletonList rows={5} rowHeight={64} gap={10} />
      </div>
    );
  }

  // K3 (target-IA) — the selected todo's detail lives in the shared
  // rightSidebar panel (Desktop); narrow shows the same panel inside the
  // MobileTodoList sheet (#470), so the portal is wide-only.
  const selected = tree.selectedTodo;
  const sheetTodo = detail.sheetTodo;

  // Shared by both surfaces so a field added to the todo detail cannot reach
  // only one width.
  const detailProps = {
    onSaveDetail: saveTodoDetail,
    dirtyRef: detailDirtyRef,
    onToggleStatus: handleToggleStatusReported,
    onDelete: handleDeleteFromDetail,
    onConvert: dataService ? handleConvertFromDetail : undefined,
    loadLinkTargets,
    onNavigateToItem,
    onResolvedLinkInserted: handleResolvedLinkInserted,
  };

  return (
    // #1124: the tour's "finish one of them" step points here rather than at a
    // single control, because completing has three routes (drag to Done, the
    // Desktop detail's toggle, the narrow status row) and singling one out
    // would teach the other two as wrong.
    <div
      {...tourAnchor(TOUR_ANCHORS.scheduleTodoBoard)}
      className="flex h-full min-h-0 flex-col"
    >
      {moveError && (
        <p
          role="alert"
          className="mx-2 mt-2 rounded-md border border-lumen-danger px-3 py-2 text-sm text-lumen-danger"
        >
          {moveError}
        </p>
      )}

      {isWide ? (
        // BOARD — full-width DnD board (the Todos view; list mode retired).
        // The board's own toolbar hosts the grouping switch + "+ Add".
        <div className="flex min-h-0 flex-1 flex-col px-lumen-gutter pt-4 md:px-lumen-gutter-wide">
          {columns.length === 0 ? (
            <EmptyState
              icon={<ListTodo aria-hidden />}
              message={t("materials.todos.empty")}
              cta={{
                label: t("materials.todos.addCta"),
                onClick: openAdd,
              }}
            />
          ) : (
            <KanbanBoardSurface
              columns={columns}
              labels={labels}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              onSelectCard={handleSelectCard}
              onColorChange={handleColorChange}
              onAdd={openAdd}
              dnd={dnd}
            />
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <MobileTodoList
            statusColumns={statusColumns}
            cardLabels={labels}
            labels={{
              statusNotStarted: t("todoDetail.statusNotStarted"),
              statusDone: t("todoDetail.statusDone"),
              filterLabel: t("materials.todos.filterLabel"),
              detailTitle: t("materials.todos.detailTitle"),
              close: t("common.close"),
              empty: t("materials.todos.empty"),
              addCta: t("materials.todos.addCta"),
              quickAddTitle: t("materials.todos.quickAddTitle"),
              quickAddPlaceholder: t("materials.todos.quickAddPlaceholder"),
              quickAddSubmit: t("materials.todos.quickAddSubmit"),
            }}
            onQuickAdd={(title) => {
              tree.addNode("task", null, title);
              reportTourAction(TOUR_ACTIONS.scheduleTodoCreated);
            }}
            detailTodoId={sheetTodo ? sheetTodo.id : null}
            onSelectTodo={detail.openSheet}
            // #736: the sheet funnels Escape, the backdrop and its close button
            // into this one callback, so guarding it covers every narrow exit.
            onCloseDetail={() => {
              void requestDetailClose(detail.closeSheet);
            }}
            detail={
              sheetTodo ? (
                // Mobile: the same panel in the bottom sheet, with the touch
                // status row instead of the Desktop cycle button (#470).
                <TodoDetailContent
                  todo={sheetTodo}
                  statusControl={
                    <TodoStatusChoices
                      value={sheetTodo.status ?? "NOT_STARTED"}
                      onChange={(status) =>
                        handleSetTodoStatusReported(sheetTodo.id, status)
                      }
                      labels={labels}
                      label={t("materials.todos.statusGroupLabel")}
                    />
                  }
                  {...detailProps}
                />
              ) : null
            }
          />
        </div>
      )}

      {/* Desktop rightSidebar content (wide-only, so narrow never fills the
          MobileDrawer): the selected todo's detail. The portal renders nothing
          until a card-click both selects and opens the panel. */}
      {isWide && selected && (
        <RightSidebarPortal>
          <TodoDetailContent todo={selected} {...detailProps} />
        </RightSidebarPortal>
      )}

      {isWide && (
        <TodoAddDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSubmit={handleAddSubmitReported}
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
