import type { ComponentProps, ReactNode } from "react";
import {
  ConfirmDialog,
  ItemActionPopover,
  ItemCreatePanel,
  ItemDetailOverlay,
  Modal,
  QuickCaptureSheet,
  RepeatScopeDialog,
  TagFilterPanel,
  useTranslation,
  type ConfirmRequest,
  type ItemCreatePanelHandlers,
  type ItemCreatePanelLabels,
  type ItemCreatePanelPools,
  type ScheduleItem,
  type TagFilterPanelProps,
  type TodoCalendarChip,
} from "@life-editor/shared";
import { todoChipPanelModel } from "./todoChipPanel";
import type {
  SchedulePopover,
  ScheduleCreatePanel,
} from "./useScheduleOverlays";

/*
 * Everything the Calendar mounts ON TOP of the grid, in one place (#889).
 *
 * The two layouts used to hand-list their own overlays at the end of their own
 * return, and the lists had drifted apart: Desktop never mounted the
 * <ConfirmDialog>. `useConfirmDialog().ask()` returns a promise that only
 * settles when that dialog answers, so on Desktop every question simply never
 * came back — closing a dirty editor did nothing at all (the overlay stayed put
 * with no way out but a reload), a todo delete with children never ran, and the
 * Event↔Todo conversion stopped at the confirm. On Mobile all three worked.
 *
 * That is the failure mode a duplicated mount list produces, so the fix is not
 * to add one dialog back but to leave the layouts nothing to list: the host
 * renders <ScheduleOverlays> once and both branches get the same set.
 *
 * The ORDER here carries one rule: the confirm dialog is last, so it portals
 * above the editor overlay / sheet it is usually asked from (#707) — a discard
 * question has to sit on top of the thing it is about. The rest is free; the
 * creation surface and the detail frames are never open together (every submit
 * runs `finishCreatePanel()` before it selects or opens — see
 * useScheduleCreateFlow, #889).
 *
 * i18n is resolved here rather than injected: this is a web host module that
 * only arranges shared parts, and threading two dozen labels through it is the
 * shape #893 removed from the parts underneath (§6.4 allows the host side to
 * call `useTranslation()`).
 */

/** The single-click bubble's item actions (#299 / #551 / #625). */
export interface ScheduleItemPopoverActions {
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onConvertToTodo: (id: string) => void;
  onDelete: (id: string) => void;
}

/** The todo-chip variant of the same bubble (#564 / #626 / #625). */
export interface ScheduleTodoPopoverActions {
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onConvertToEvent: (id: string) => void;
}

export interface ScheduleOverlaysProps {
  isWide: boolean;
  /**
   * The two detail frames, built by the host because their bodies need the
   * editor draft and the todo panel wiring. Passed as nodes so the mounting
   * order above still lives in one place.
   */
  frames: { editor: ReactNode; todoDetail: ReactNode };
  popover: {
    state: SchedulePopover | null;
    /** The schedule item behind the bubble, or null when it is a todo chip. */
    selected: ScheduleItem | null;
    /** The todo chip behind the bubble, when the bubble belongs to one. */
    todoChip: TodoCalendarChip | null;
    onClose: () => void;
    onOpenDetail: (id: string) => void;
    itemActions: ScheduleItemPopoverActions;
    todoActions: ScheduleTodoPopoverActions;
  };
  create: {
    panel: ScheduleCreatePanel | null;
    /** Stands in for the day while the sheet is mounted but closed. */
    anchorDate: string;
    onClose: () => void;
    pools: ItemCreatePanelPools;
    handlers: ItemCreatePanelHandlers;
    formatDuration: (minutes: number) => string;
    labels: ItemCreatePanelLabels;
  };
  /** #1173 — the tag-filter panel the toolbar's filter button opens. */
  tagFilter: {
    open: boolean;
    onClose: () => void;
    panel: TagFilterPanelProps;
  };
  scope: {
    request: { mode: "edit" | "delete" } | null;
    onChoose: ComponentProps<typeof RepeatScopeDialog>["onChoose"];
    onClose: () => void;
  };
  confirm: {
    request: ConfirmRequest | null;
    onResolve: (confirmed: boolean) => void;
  };
}

export function ScheduleOverlays({
  isWide,
  frames,
  popover,
  create,
  tagFilter,
  scope,
  confirm,
}: ScheduleOverlaysProps) {
  const { t } = useTranslation();

  // The todo action set. Deliberately not the event one: a todo has no
  // duplicate write and its detail lives in another section (todoChipPanel.ts).
  const todoChipPanel = popover.todoChip
    ? todoChipPanelModel(
        popover.todoChip,
        {
          // NOT scheduleScreen.untitled — that one reads "無題の繰り返し",
          // written for the repeat list. A todo is neither.
          untitled: t("common.untitled"),
          allDay: t("scheduleScreen.allDay"),
          rename: t("scheduleScreen.rename"),
          delete: t("todoDetail.todoDelete"),
          convertToEvent: t("itemConvert.toEvent"),
        },
        {
          onRename: (title) =>
            popover.todoActions.onRename(popover.todoChip!.id, title),
          onDelete: () => popover.todoActions.onDelete(popover.todoChip!.id),
          onConvertToEvent: () =>
            popover.todoActions.onConvertToEvent(popover.todoChip!.id),
        },
      )
    : null;

  // #299 single-click bubble (Desktop): summary + quick actions + "詳細を編集".
  // `selected` is the popover's item (activate sets selectedId + popover to the
  // same id); guard against a transient mismatch. Portalled to body → does not
  // touch the rightSidebar contentCount invariant.
  const bubble =
    !isWide || !popover.state ? null : todoChipPanel ? (
      <ItemActionPopover
        key={popover.state.id}
        position={{ x: popover.state.x, y: popover.state.y }}
        summary={
          <div className="flex flex-col gap-0.5">
            <p className="truncate font-semibold text-lumen-text">
              {todoChipPanel.title}
            </p>
            <p className="text-lumen-text-secondary">
              {todoChipPanel.timeLabel}
            </p>
          </div>
        }
        actions={todoChipPanel.actions}
        onEditDetail={() => popover.onOpenDetail(popover.state!.id)}
        // #626: the primary hand-off now opens the in-Schedule todo detail
        // (tags editable in place); "open in Todos" moved inside that panel.
        editDetailLabel={t("scheduleScreen.editDetail")}
        label={t("scheduleScreen.itemActionsLabel")}
        onClose={popover.onClose}
      />
    ) : popover.selected && popover.selected.id === popover.state.id ? (
      <ItemActionPopover
        // Remount per item: without a mousedown in between (e.g. the keyboard
        // contextmenu key) the id can swap while the bubble stays mounted,
        // and a rename draft from the previous item would survive the swap.
        key={popover.state.id}
        position={{ x: popover.state.x, y: popover.state.y }}
        summary={
          <div className="flex flex-col gap-0.5">
            <p className="truncate font-semibold text-lumen-text">
              {popover.selected.title || t("scheduleCalendar.newEvent")}
            </p>
            <p className="text-lumen-text-secondary">
              {popover.selected.isAllDay
                ? t("scheduleScreen.allDay")
                : `${popover.selected.startTime}–${popover.selected.endTime}`}
            </p>
          </div>
        }
        actions={[
          // #551: rename rides the unified bubble as an inline input — the
          // retired right-click menu was the only place it lived before.
          {
            id: "rename",
            label: t("scheduleScreen.rename"),
            inlineInput: {
              value: popover.selected.title,
              ariaLabel: t("scheduleScreen.rename"),
              onCommit: (title) =>
                popover.itemActions.onRename(popover.state!.id, title),
            },
          },
          {
            id: "duplicate",
            label: t("scheduleScreen.duplicate"),
            onSelect: () => popover.itemActions.onDuplicate(popover.state!.id),
          },
          // #625: stays enabled for a routine occurrence too — selecting it
          // then explains why a Todo cannot hold a repeat (D-20260810-sched-5,
          // user-specified shape).
          {
            id: "convertToTodo",
            label: t("itemConvert.toTodo"),
            onSelect: () =>
              popover.itemActions.onConvertToTodo(popover.state!.id),
          },
          {
            id: "delete",
            label: t("scheduleScreen.delete"),
            danger: true,
            onSelect: () => popover.itemActions.onDelete(popover.state!.id),
          },
        ]}
        onEditDetail={() => popover.onOpenDetail(popover.state!.id)}
        editDetailLabel={t("scheduleScreen.editDetail")}
        label={t("scheduleScreen.itemActionsLabel")}
        onClose={popover.onClose}
      />
    ) : null;

  /*
   * #299 → #376 creation surface. One panel, two frames — the Desktop overlay
   * and the Mobile sheet — picked by width, the same fold <ResponsiveDetailFrame>
   * already does for the editor. Both frames get the identical pools, handlers
   * and labels; what differs is only how the day reaches the panel.
   *
   * Desktop guards the panel with `create.panel &&`, so it can read the day
   * straight off it. The sheet cannot: <QuickCaptureSheet> takes `initial` as
   * its own prop and passes it down, so the value has to exist even on the
   * renders where nothing is open (`initial.date` is required since #940 — the
   * day is an input now, not a printed label). The anchor day is the stand-in;
   * it is never the day a user sees, because a sheet only ever opens with a
   * panel behind it.
   */
  const panelProps = {
    pools: create.pools,
    handlers: create.handlers,
    formatDuration: create.formatDuration,
    labels: create.labels,
  };
  const createFrame = isWide ? (
    <ItemDetailOverlay
      open={!!create.panel}
      title={t("scheduleScreen.addItem")}
      onClose={create.onClose}
    >
      {create.panel && (
        <ItemCreatePanel
          // Keyed on the prefill so a new empty-slot click while open re-seeds
          // the fields.
          key={`${create.panel.date}-${create.panel.start}-${create.panel.end}`}
          initial={{
            date: create.panel.date,
            start: create.panel.start,
            end: create.panel.end,
          }}
          {...panelProps}
        />
      )}
    </ItemDetailOverlay>
  ) : (
    <QuickCaptureSheet
      open={!!create.panel}
      onClose={create.onClose}
      sheetTitle={t("scheduleScreen.addItem")}
      closeLabel={t("common.close")}
      initial={{
        date: create.panel?.date ?? create.anchorDate,
        start: create.panel?.start,
        end: create.panel?.end,
      }}
      {...panelProps}
    />
  );

  return (
    <>
      <Modal
        open={tagFilter.open}
        onClose={tagFilter.onClose}
        title={t("scheduleScreen.filterTitle")}
        size="lg"
      >
        <TagFilterPanel {...tagFilter.panel} />
      </Modal>
      {bubble}
      {createFrame}
      {frames.editor}
      {frames.todoDetail}
      {/* #279: this/future/all chooser — centered on every layout per the issue. */}
      <RepeatScopeDialog
        open={!!scope.request}
        mode={scope.request?.mode ?? "edit"}
        labels={{
          title:
            scope.request?.mode === "delete"
              ? t("scheduleScreen.deleteScopeTitle")
              : t("scheduleScreen.editScopeTitle"),
          thisOnly: t("scheduleScreen.scopeThisOnly"),
          thisAndFuture: t("scheduleScreen.scopeThisAndFuture"),
          all: t("scheduleScreen.scopeAll"),
          cancel: t("scheduleScreen.scopeCancel"),
        }}
        onChoose={scope.onChoose}
        onClose={scope.onClose}
      />
      {/* #707: mounted last so it portals ABOVE the editor overlay / sheet it
          is usually asked from — the discard question has to sit on top of the
          thing it is about. It holds no place in the tree while nothing is
          being asked. */}
      {confirm.request && (
        <ConfirmDialog
          open
          message={confirm.request.message}
          confirmLabel={confirm.request.confirmLabel}
          cancelLabel={confirm.request.cancelLabel}
          danger={confirm.request.danger}
          onConfirm={() => confirm.onResolve(true)}
          onCancel={() => confirm.onResolve(false)}
        />
      )}
    </>
  );
}
