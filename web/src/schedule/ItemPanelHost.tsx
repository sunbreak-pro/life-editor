import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RoutineProvider,
  ScheduleItemsProvider,
  TagGroupProvider,
  TodoTreeProvider,
  WikiTagsUnifiedProvider,
  WIDE_QUERY,
  frequencyLabel,
  todoScheduleSlot,
  useConfirmDialog,
  useItemPanelOptional,
  useMediaQuery,
  useRoutineContext,
  useScheduleItemsContext,
  useScheduleItemsRoutineSync,
  useSyncDomains,
  useToast,
  useTodoTreeContext,
  useTranslation,
  useUndoRedoOptional,
  type DataService,
  type EventEditorItem,
  type FrequencyEditorValue,
  type ItemPanelRequest,
} from "@life-editor/shared";
import { ScheduleOverlayHost } from "./ScheduleOverlayHost";
import { useCreatePanelNotes } from "./useCreatePanelNotes";
import { useCreatePanelTags } from "./useCreatePanelTags";
import { useVisibleRangeItems } from "./useVisibleRangeItems";
import { useRepeatUndoGate } from "./useRepeatUndoGate";
import { useScheduleMutations } from "./useScheduleMutations";
import { useItemConversion } from "./useItemConversion";
import { useScheduleTodoChips } from "./useScheduleTodoChips";
import { useScheduleCreateFlow } from "./useScheduleCreateFlow";
import { useTagFilterPanel } from "./useTagFilterPanel";
import { toEditorItem } from "./scheduleViewModels";
import { scheduleItemById, selectionSurface } from "./scheduleSelectionSurface";
import { useScheduleCopy } from "./scheduleCopy";
import { useTodoLinking } from "./useTodoLinking";
import { useScheduleWriteErrors } from "./useScheduleWriteErrors";
import { useDuplicateTagCopy } from "./useDuplicateTagCopy";
import type { ScheduleCreatePanel } from "./useScheduleOverlays";

/*
 * The Schedule's editor and creation panel, opened from another screen
 * (#2218). Whoever calls `useItemPanelContext().openEdit / openCreate` gets
 * the same panel the Schedule draws, on top of the screen they are on.
 *
 * WHY a second mount of the Schedule's Provider stack rather than lifting it
 * to the global layer (the issue's other option): the five Providers are
 * section-layer on purpose — each fetches its whole domain and subscribes to
 * Realtime, and lifting them would make every screen pay for the calendar.
 * Here they mount only while a panel is up. The cost is a second fetch while
 * it is open, on a screen that already has a copy (Connect's tag tab mounts
 * WikiTagsUnified).
 *
 * WHY the Schedule's own hooks rather than a slimmer write path: "the same
 * panel" includes what its buttons do — the this/future/all question on a
 * repeating row, the undo entry, the Event ⇄ Todo conversion. Those live in
 * useScheduleMutations / useItemConversion / useScheduleTodoChips, so this
 * host calls them as CalendarTab does and renders the same
 * <ScheduleOverlayHost>. What it leaves out is everything that draws the
 * calendar: the grid, its filters, the sidebar and the bubble.
 *
 * Undo: the Providers below expire their undo entries when they unmount, so an
 * edit made here can be undone while the panel is open and not after it — the
 * same rule as leaving the Schedule section.
 *
 * Not for the Schedule section itself, which has its own overlay set: calling
 * this there would mount the stack twice.
 */

const NOOP = (): void => {};
const NO_TAGS: string[] = [];

export function ItemPanelHost({ dataService }: { dataService: DataService }) {
  const panel = useItemPanelOptional();
  if (!panel?.request) return null;
  return (
    <TodoTreeProvider dataService={dataService}>
      <WikiTagsUnifiedProvider dataService={dataService}>
        <TagGroupProvider dataService={dataService}>
          <RoutineProvider dataService={dataService}>
            <ScheduleItemsProvider dataService={dataService}>
              <ItemPanelSurface
                // A new request starts from a clean slate: the selection, the
                // draft and the "has it been open yet" flag below.
                key={panel.request.seq}
                request={panel.request}
                onClose={panel.close}
                dataService={dataService}
              />
            </ScheduleItemsProvider>
          </RoutineProvider>
        </TagGroupProvider>
      </WikiTagsUnifiedProvider>
    </TodoTreeProvider>
  );
}

function ItemPanelSurface({
  request,
  onClose,
  dataService,
}: {
  request: ItemPanelRequest;
  onClose: () => void;
  dataService: DataService;
}) {
  const { t } = useTranslation();
  const isWide = useMediaQuery(WIDE_QUERY, true);
  const {
    date: today,
    items: contextItems,
    loadDateRange,
    createScheduleItem,
    updateScheduleItem,
    dismiss,
    deleteScheduleItem,
    registerViewMirror,
  } = useScheduleItemsContext();
  const {
    routines,
    convertEventToRoutine,
    updateRoutine,
    deleteRoutine,
    detachRoutine,
    updateFutureOccurrences,
  } = useRoutineContext();
  const syncVersion = useSyncDomains("schedule");
  const { ensureRoutineItemsForDateRange, reconcileRoutineScheduleItems } =
    useScheduleItemsRoutineSync({ dataService });
  const {
    nodes: todoNodes,
    addNode,
    updateNode,
    setTodoStatus,
    toggleTodoStatus,
    softDelete: softDeleteTodo,
    refetch: refetchTodos,
  } = useTodoTreeContext();
  const { showToast } = useToast();
  const undoRedo = useUndoRedoOptional();
  const {
    request: confirmRequest,
    ask: askConfirm,
    resolve: resolveConfirm,
  } = useConfirmDialog();
  useRepeatUndoGate(askConfirm);
  const {
    handleAttachError,
    handleRepeatConvertError,
    handleDuplicateError,
    handleDuplicateTagsError,
    handleCreateError,
  } = useScheduleWriteErrors(showToast);
  const { tagCountOf, copyTagsFrom } = useDuplicateTagCopy(
    handleDuplicateTagsError,
  );

  // The one day this host loads: the row's own day for an event, the seeded
  // day for a creation, today for a todo (its detail reads the tree, not the
  // range).
  const day =
    request.mode === "create"
      ? request.initial.date
      : request.target.role === "event"
        ? request.target.date
        : today;

  // What CalendarTab keeps in useScheduleSelection / useScheduleOverlays,
  // seeded from the request instead of from a click.
  const [selectedId, setSelectedId] = useState<string | null>(
    request.mode === "edit" && request.target.role === "event"
      ? request.target.id
      : null,
  );
  const [overlayOpen, setOverlayOpen] = useState(
    request.mode === "edit" && request.target.role === "event",
  );
  const [createPanel, setCreatePanel] = useState<ScheduleCreatePanel | null>(
    request.mode === "create"
      ? {
          date: request.initial.date,
          start: request.initial.start ?? "09:00",
          end: request.initial.end ?? "10:00",
        }
      : null,
  );

  const {
    todoAddable,
    findTodoChip,
    todoDetailId,
    setTodoDetailId,
    handleTodoChipMove,
    handleTodoChipResize,
    handleTodoChipDropAllDay,
    handleTodoRename,
    handleTodoDelete,
    handleTodoDetailDelete,
  } = useScheduleTodoChips({
    todoNodes,
    updateNode,
    setTodoStatus,
    softDeleteTodo,
    today,
    rangeStart: day,
    rangeEnd: day,
    askConfirm,
  });
  useEffect(() => {
    if (request.mode === "edit" && request.target.role === "task")
      setTodoDetailId(request.target.id);
    // Once, on mount: the key above remounts this for every new request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { rangeItems, setRangeItems, patchRange, viewMirror, reload } =
    useVisibleRangeItems({
      loadDateRange,
      rangeStart: day,
      rangeEnd: day,
      refreshKey: syncVersion,
    });
  // #568: the provider's undo commands roll back THIS store, as they do the
  // grid's.
  useEffect(
    () => registerViewMirror(viewMirror),
    [registerViewMirror, viewMirror],
  );

  const selected = useMemo(
    () =>
      selectedId
        ? (scheduleItemById(selectedId, rangeItems, contextItems) ?? null)
        : null,
    [selectedId, rangeItems, contextItems],
  );

  const {
    notes: noteOptions,
    notesError,
    attachNote,
    attachNoteAlongside,
  } = useCreatePanelNotes({
    dataService,
    active: !!createPanel,
    onAttachError: handleAttachError,
    push: undoRedo?.push,
  });
  // #2220: the create panel's tag field — staged there, written here once
  // the new row exists.
  const { tagPool, takeStagedTags, applyTags } = useCreatePanelTags();
  const createTags = useMemo(
    () => ({ take: takeStagedTags, apply: applyTags }),
    [takeStagedTags, applyTags],
  );

  const {
    scopeRequest,
    closeScopeRequest,
    handleScopeChoose,
    handleUpdate,
    handleCreate,
    handleDismiss,
    handleDelete,
    handleRename,
    handleDuplicate,
    handleChangeRepeat,
    handleDetachRepeat,
    repeatConverting,
  } = useScheduleMutations({
    rangeItems,
    setRangeItems,
    patchRange,
    reload,
    contextItems,
    rangeStart: day,
    rangeEnd: day,
    today,
    selected,
    setSelectedId,
    onSelectItem: setSelectedId,
    createScheduleItem,
    updateScheduleItem,
    dismiss,
    deleteScheduleItem,
    routines,
    convertEventToRoutine,
    updateRoutine,
    deleteRoutine,
    detachRoutine,
    updateFutureOccurrences,
    ensureRoutineItemsForDateRange,
    reconcileRoutineScheduleItems,
    onMoveTodoChip: handleTodoChipMove,
    onResizeTodoChip: handleTodoChipResize,
    onDropTodoChipAllDay: handleTodoChipDropAllDay,
    onRepeatConvertFailed: handleRepeatConvertError,
    onDuplicateFailed: handleDuplicateError,
    onCreateFailed: handleCreateError,
    copyTagsFrom,
    push: undoRedo?.push,
    copySuffix: t("scheduleScreen.copySuffix"),
  });

  const {
    handleCreateSubmit,
    handleCreateSubmitAndOpen,
    handleCreateTodoSubmit,
    handlePlaceTodoSubmit,
  } = useScheduleCreateFlow({
    createPanel,
    setCreatePanel,
    setPopover: NOOP,
    anchorDate: day,
    isWide,
    setSelectedId,
    setOverlayOpen,
    handleCreate,
    addNode,
    updateNode,
    attachNote,
    attachNoteAlongside,
    onAttachError: handleAttachError,
    // There is no calendar lens here to clear.
    clearTagLens: NOOP,
    tags: createTags,
  });

  const {
    weekdayLabels,
    freqCopy,
    repeatLabels,
    createPanelLabels,
    formatDuration,
  } = useScheduleCopy({ isWide, notesError, selectedTagCount: 0 });

  const { handleConvertToTodo, handleConvertToEvent } = useItemConversion({
    dataService,
    rangeItems,
    contextItems,
    todoNodes,
    listDate: today,
    reload,
    refetchTodos,
    showToast,
    askConfirm,
    closePopover: NOOP,
    closeTodoDetail: () => setTodoDetailId(null),
    closeEditor: () => {
      setOverlayOpen(false);
      setSelectedId(null);
    },
    push: undoRedo?.push,
  });
  const todoLinking = useTodoLinking({ dataService });

  // useScheduleRepeats / useScheduleTodayAgenda derive these two from the
  // selection, but those hooks also drive the sidebar, which this host lacks.
  const selectedRoutine = useMemo(
    () =>
      selected?.routineId != null
        ? (routines.find((r) => r.id === selected.routineId) ?? null)
        : null,
    [selected, routines],
  );
  const repeatValue = useMemo<FrequencyEditorValue | null>(
    () =>
      selectedRoutine
        ? {
            frequencyType: selectedRoutine.frequencyType,
            frequencyDays: selectedRoutine.frequencyDays,
            frequencyInterval: selectedRoutine.frequencyInterval,
            frequencyStartDate: selectedRoutine.frequencyStartDate,
            frequencyEndDate: selectedRoutine.frequencyEndDate ?? null,
          }
        : null,
    [selectedRoutine],
  );
  const originDetail = selectedRoutine
    ? frequencyLabel(selectedRoutine, freqCopy, weekdayLabels)
    : undefined;

  // The overlay set takes a tag-filter panel; this host never opens it.
  const noCounts = useMemo(() => new Map<string, number>(), []);
  const tagFilterPanel = useTagFilterPanel({
    selectedTagIds: NO_TAGS,
    tagCounts: noCounts,
    onToggleTag: NOOP,
    onClear: NOOP,
    onApplyGroup: NOOP,
  });

  const editorItem: EventEditorItem | null = toEditorItem(selected);

  /*
   * The request ends when every surface it drew has shut. "Has been open" is
   * tracked because an event's row arrives with the range fetch — before
   * that nothing is open yet, and the request must not end on its first
   * render.
   */
  const anyOpen =
    selectionSurface(isWide).editorOpen(!!editorItem, overlayOpen) ||
    todoDetailId != null ||
    createPanel != null ||
    scopeRequest != null ||
    confirmRequest != null;
  const everOpen = useRef(false);
  useEffect(() => {
    if (anyOpen) everOpen.current = true;
    else if (everOpen.current) onClose();
  }, [anyOpen, onClose]);

  const { onOpenInSchedule, onNavigateToItem } = request.options;
  const openEventInSchedule = useCallback(() => {
    if (!onOpenInSchedule || !selected) return;
    onClose();
    onOpenInSchedule({ id: selected.id, role: "event", date: selected.date });
  }, [onOpenInSchedule, selected, onClose]);
  const openTodoInSchedule = useCallback(
    (id: string) => {
      if (!onOpenInSchedule) return;
      const node = todoNodes.find((n) => n.id === id);
      const slot = node ? todoScheduleSlot(node) : null;
      onClose();
      onOpenInSchedule({ id, role: "task", date: slot?.date ?? null });
    },
    [onOpenInSchedule, todoNodes, onClose],
  );

  return (
    <ScheduleOverlayHost
      isWide={isWide}
      editor={{
        item: editorItem,
        overlayOpen,
        onCloseOverlay: () => setOverlayOpen(false),
        onClearSelection: () => setSelectedId(null),
        askConfirm,
        routineId: selected?.routineId,
        handlers: {
          onSave: handleUpdate,
          onDismiss: handleDismiss,
          onDelete: handleDelete,
        },
        options: {
          originDetail,
          canEditDate: true,
          canEditAllDay: true,
          formatDuration,
        },
        repeat: {
          value: repeatValue,
          weekdayLabels,
          labels: repeatLabels,
          pending: repeatConverting,
          onChange: handleChangeRepeat,
          onDetach: handleDetachRepeat,
        },
        onConvertToTodo: handleConvertToTodo,
        onDuplicate: handleDuplicate,
        duplicateTagCount: selected ? tagCountOf(selected) : 0,
        onOpenInSchedule: onOpenInSchedule ? openEventInSchedule : undefined,
      }}
      todoDetail={{
        todoId: todoDetailId,
        todoNodes,
        onClose: () => setTodoDetailId(null),
        writes: {
          updateNode,
          toggleStatus: toggleTodoStatus,
          setStatus: setTodoStatus,
          onDelete: handleTodoDetailDelete,
        },
        onConvertToEvent: handleConvertToEvent,
        linking: todoLinking,
        onNavigateToItem,
        askConfirm,
        onOpenInSchedule: onOpenInSchedule ? openTodoInSchedule : undefined,
      }}
      popover={{
        state: null,
        selected,
        selectedTagCount: 0,
        findTodoChip,
        onClose: NOOP,
        onOpenDetail: NOOP,
        itemActions: {
          onRename: handleRename,
          onRetime: (id, next) =>
            handleUpdate(id, { startTime: next.start, endTime: next.end }),
          onDuplicate: handleDuplicate,
          onConvertToTodo: handleConvertToTodo,
          onDelete: handleDelete,
        },
        todoActions: {
          onRename: handleTodoRename,
          onDelete: handleTodoDelete,
          onConvertToEvent: handleConvertToEvent,
        },
      }}
      create={{
        panel: createPanel,
        anchorDate: day,
        onClose: () => setCreatePanel(null),
        pools: { todos: todoAddable, notes: noteOptions, tags: tagPool },
        handlers: {
          onSubmitEvent: handleCreateSubmit,
          onSubmitEventAndOpen: handleCreateSubmitAndOpen,
          onCreateTodo: handleCreateTodoSubmit,
          onPlaceTodo: handlePlaceTodoSubmit,
        },
        formatDuration,
        labels: createPanelLabels,
      }}
      repeatPanel={{
        state: null,
        row: null,
        onClose: NOOP,
        onShowNext: NOOP,
        onEditDetail: NOOP,
      }}
      tagFilter={{ open: false, onClose: NOOP, panel: tagFilterPanel }}
      scope={{
        request: scopeRequest,
        onChoose: handleScopeChoose,
        onClose: closeScopeRequest,
      }}
      confirm={{ request: confirmRequest, onResolve: resolveConfirm }}
    />
  );
}
