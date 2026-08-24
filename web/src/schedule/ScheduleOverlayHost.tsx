import type { ReactNode } from "react";
import {
  ItemRoleBadge,
  ResponsiveDetailFrame,
  useTranslation,
  type EventEditorItem,
  type TodoCalendarChip,
} from "@life-editor/shared";
import {
  ScheduleOverlays,
  type ScheduleOverlaysProps,
} from "./ScheduleOverlays";
import {
  ScheduleTodoDetail,
  type ScheduleTodoDetailProps,
} from "./ScheduleTodoDetail";
import { useScheduleRoleLabels } from "./scheduleRoleLabels";

/*
 * The Calendar's overlay layer, assembled once for both layouts (#889).
 *
 * <ScheduleOverlays> takes its two detail frames as nodes, so somebody has to
 * build them. In CalendarTab that somebody was four consts in a row — the chip
 * behind an open bubble, the event editor's frame, the todo detail's frame, and
 * the <ScheduleOverlays> element that consumed all three — and nothing else in
 * the host read any of them. Four names for one thing; this is the thing.
 *
 * The rule the arrangement protects is #889's: ONE overlay set for both
 * layouts. The two returns used to hand-list their own and the lists had
 * drifted — Desktop never mounted the <ConfirmDialog>, so every ask() there
 * returned a promise nothing ever settled (see the ScheduleOverlays header for
 * the three surfaces that left hanging). Frames built beside the element that
 * mounts them cannot drift from it.
 *
 * A HOST component, not a shared one — the same line ScheduleOverlays and
 * ScheduleEventEditor draw. It arranges parts that already live in
 * `shared/src/components/`, resolves its own copy with `useTranslation()`
 * (§6.4 allows the host side to), and `web/src/schedule/` is where #675 / #889
 * put every other piece pulled out of CalendarTab.
 *
 * Zero behaviour change (#889): every prop, label key and condition below is
 * the value CalendarTab handed these parts.
 */

export interface ScheduleOverlayHostProps {
  isWide: boolean;
  /**
   * The event editor's FRAME — the body arrives as `pane` because only the host
   * can build it (it holds the draft, the repeat wiring and the tag slot).
   */
  editor: {
    /** The selection as the pane sees it (#673 `toEditorItem`), or null. */
    item: EventEditorItem | null;
    /** Desktop's overlay flag; narrow opens on the selection alone. */
    overlayOpen: boolean;
    /** <ScheduleEventEditor>, already wired. */
    pane: ReactNode;
    /** #628 useEditorCloseGuard — runs `close` once the discard is agreed. */
    requestClose: (close: () => void) => Promise<void>;
    /** What "closed" means on Desktop: drop the overlay flag. */
    onCloseOverlay: () => void;
    /** What it means on narrow: drop the selection, because it IS the sheet. */
    onClearSelection: () => void;
  };
  /** Straight through to <ScheduleTodoDetail>; only the width is ours. */
  todoDetail: Omit<ScheduleTodoDetailProps, "isWide">;
  /**
   * The bubble, minus the chip behind it: that one is resolved here, from the
   * lookup below, because the frames it sits among are resolved here too.
   */
  popover: Omit<ScheduleOverlaysProps["popover"], "todoChip"> & {
    findTodoChip: (chipId: string) => TodoCalendarChip | null;
  };
  create: ScheduleOverlaysProps["create"];
  calendars: ScheduleOverlaysProps["calendars"];
  scope: ScheduleOverlaysProps["scope"];
  confirm: ScheduleOverlaysProps["confirm"];
}

export function ScheduleOverlayHost({
  isWide,
  editor,
  todoDetail,
  popover,
  create,
  calendars,
  scope,
  confirm,
}: ScheduleOverlayHostProps) {
  const { t } = useTranslation();
  const roleLabels = useScheduleRoleLabels();
  const { findTodoChip, ...popoverProps } = popover;

  /*
   * #564: the chip behind an open bubble, when the bubble belongs to a TODO
   * chip rather than a schedule item. One popover serves both kinds, so the id
   * decides — an event id finds no chip and the bubble falls through to
   * `popover.selected` instead.
   *
   * The LOOKUP is handed in rather than the two chip lists, because which lists
   * it has to search (and why it must ignore the calendar lens) is reasoning
   * that belongs with the lists: see `findTodoChip` in useScheduleTodoChips.
   */
  const popoverTodoChip = popover.state ? findTodoChip(popover.state.id) : null;

  // #299 detail-edit overlay (Desktop): the former rightSidebar "詳細" tab body
  // (EventEditorPane) now rides a body-level modal. Mobile keeps the BottomSheet.
  // #628: Escape and the backdrop both land on this one onClose, so guarding it
  // covers every Desktop exit at once.
  //
  // #889: one frame for both layouts. The overlay and the sheet used to be
  // written out separately — the overlay in CalendarTab's Desktop branch, the
  // sheet at the end of the narrow one — with the same title, the same body and
  // the same close guard in each. What differs is only what "closed" MEANS:
  // Desktop drops the overlay flag, Mobile clears the selection, because on
  // Mobile the selection IS the sheet.
  const detailFrameEl = (
    <ResponsiveDetailFrame
      wide={isWide}
      // #889: the ITEM decides, not the pane. <ScheduleEventEditor> is an
      // element on every render now and answers the "is anything selected?"
      // question by rendering null from the inside, so the node can no longer
      // stand in for the answer the way the old `editorPane ?? null` did.
      open={isWide ? editor.overlayOpen && !!editor.item : !!editor.item}
      title={t("scheduleScreen.detailTitle")}
      // #1044: the kind is a glyph in the header now, not a word in the body.
      // Always "event" — a routine OCCURRENCE is still an `items_meta.role =
      // 'event'` row (the UI presents Routine as "an Event with a repeat"), and
      // "routine" is outside the designed kind set, so it would resolve to the
      // neutral fallback.
      titleIcon={<ItemRoleBadge role="event" labels={roleLabels} compact />}
      closeLabel={t("common.close")}
      // #628: Escape, the backdrop and the close button all land here, so the
      // one guard covers every exit on either layout.
      onClose={() => {
        void editor.requestClose(() =>
          isWide ? editor.onCloseOverlay() : editor.onClearSelection(),
        );
      }}
    >
      {editor.pane}
    </ResponsiveDetailFrame>
  );

  return (
    <ScheduleOverlays
      isWide={isWide}
      frames={{
        editor: detailFrameEl,
        todoDetail: <ScheduleTodoDetail isWide={isWide} {...todoDetail} />,
      }}
      popover={{ ...popoverProps, todoChip: popoverTodoChip }}
      create={create}
      calendars={calendars}
      scope={scope}
      confirm={confirm}
    />
  );
}
