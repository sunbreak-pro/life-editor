import { useState } from "react";
import {
  EventEditorPane,
  ItemNoteAttach,
  SegmentedControl,
  REMINDER_LEAD_CHOICES,
  useToastOptional,
  useTranslation,
  type EventEditorHandlers,
  type EventEditorItem,
  type EventEditorOptions,
  type EventEditorReminder,
  type EventEditorRepeat,
  type EventEditorWorkTime,
} from "@life-editor/shared";
import { TagPicker } from "../wikitag/TagPicker";
import { useNoteAttachLabels, type ScheduleNoteAttach } from "./noteAttach";
import { TagColorControls } from "../wikitag/TagColorControls";
import { useEventWorkTime } from "./useEventWorkTime";
import { useEventTagDraft } from "./useEventTagDraft";
import type { DuplicateOptions } from "./useScheduleMutations";

/*
 * The Calendar's event editor — <EventEditorPane> with the copy, the tag slot
 * and the narrow-only conversion entry this host wires around it. Extracted
 * from CalendarTab by #889, where it was the `editorPane` const feeding both
 * detail frames (the Desktop overlay and the narrow sheet, folded by
 * <ResponsiveDetailFrame>).
 *
 * Renders null when there is no selected item, exactly as the const did. The
 * host still resolves `editorItem` itself: whether the frame is OPEN is read
 * off that same value, and a frame asking its own body "are you empty?" is not
 * a question a React tree can answer.
 *
 * A HOST component, not a shared one: it composes <EventEditorPane>, which
 * already lives in `shared/src/components/schedule/`, with two web-side pieces
 * (<TagPicker> / <TagColorControls>) and resolves its own copy with
 * `useTranslation()`. Pushing it into `shared/` would mean drilling the
 * fourteen label strings below through a layer that adds nothing but the
 * composition — the very shape #893 took out of the pane underneath it.
 * `web/src/schedule/` is also where #675 / #889 put every other piece pulled
 * out of CalendarTab.
 *
 * Zero behaviour change (#889): every prop below is the value CalendarTab
 * handed the pane.
 */

export interface ScheduleEventEditorProps {
  /** The selection as the pane sees it (#673 `toEditorItem`), or null. */
  item: EventEditorItem | null;
  isWide: boolean;
  /**
   * `selected.routineId` — the SERIES this occurrence was generated from, or
   * null for a manual item. Only the tag slot reads it, and the long note
   * below says why tagging writes against the series rather than the row.
   */
  routineId?: string | null;
  handlers: EventEditorHandlers;
  options: EventEditorOptions;
  repeat: EventEditorRepeat;
  /**
   * Event → Todo, from the pane on both widths (#998 narrow, #1405 Desktop).
   * The host owns both questions the press can raise — the unsaved-draft
   * discard and the routine refusal — so this is handed the id and nothing
   * else.
   */
  onConvertToTodo: (id: string) => void;
  /**
   * #2031: Duplicate from the pane. The host passes it on the narrow sheet
   * only — Desktop duplicates from the single-click bubble — and owns the
   * unsaved-draft question the press raises (the copy takes the selection,
   * so the pane moves on to it).
   */
  onDuplicate?: (id: string, options?: DuplicateOptions) => void;
  /**
   * How many tags the item shows (#2005). Above zero the pane offers "with
   * tags" / "without tags", the same pair the Desktop bubble offers.
   */
  duplicateTagCount?: number;
  /** #2219: 「ノートを添付」 at the right end of the tag row. */
  noteAttach?: ScheduleNoteAttach;
  /**
   * #2407: the footer's 「キャンセル」. The host hands in the SAME guarded
   * close its frame runs on ×, Escape and the backdrop — the pane never closes
   * itself, so an unsaved draft still gets the discard question.
   */
  onCancel?: () => void;
  /**
   * #2407: 「タグの色を変える →」 on the colour row — opens that tag on
   * Connect's tag screen. Already guarded by the host. Omit and the colour row
   * draws no link.
   */
  onOpenTag?: (tagId: string) => void;
}

export function ScheduleEventEditor({
  item,
  isWide,
  routineId,
  handlers,
  options,
  repeat,
  onConvertToTodo,
  onDuplicate,
  duplicateTagCount = 0,
  noteAttach,
  onCancel,
  onOpenTag,
}: ScheduleEventEditorProps) {
  const { t } = useTranslation();
  const noteAttachLabels = useNoteAttachLabels(noteAttach?.notesError);
  /*
   * #1663: the tag scope, per occurrence. Reset whenever the panel moves to
   * another row — a scope chosen for yesterday's occurrence must not decide
   * where tomorrow's tag lands.
   *
   * Adjusted WHILE RENDERING rather than from an effect (React's own pattern
   * for state derived from a prop, and the shape CalendarTab's pendingNewTodo
   * already uses): a synchronous setState inside an effect costs an extra
   * render pass, which is what react-hooks/set-state-in-effect objects to.
   */
  const [tagScope, setTagScope] = useState<"all" | "this">("all");
  const toast = useToastOptional();
  // #2447: the tag picks wait for 「保存」 like every other field, so a
  // cancelled edit throws them away too.
  const tagDraft = useEventTagDraft(() =>
    toast?.showToast("danger", t("materials.tags.assignFailed")),
  );
  const selectedId = item?.id ?? null;
  const [prevSelectedId, setPrevSelectedId] = useState(selectedId);
  if (selectedId !== prevSelectedId) {
    setPrevSelectedId(selectedId);
    setTagScope("all");
    // Staged against the row the panel just left, so it goes with it — the
    // pane drops its own draft on the same change (it is keyed by the id).
    tagDraft.reset();
  }
  // Before the early return — hooks cannot be called conditionally, and the
  // hook already treats a null id as "nothing to read".
  const { read: workRead, save: saveWorkTotal } = useEventWorkTime(
    item?.id ?? null,
    // #2407: the press has moved on by the time the write fails, so a toast is
    // the only place left to say it (the useScheduleWriteErrors reasoning).
    () => toast?.showToast("danger", t("scheduleScreen.workTimeSaveFailed")),
  );

  if (!item) return null;

  // The row the tags are written to. "この回のみ" is the occurrence itself,
  // and the role has to follow the id (it names `items_meta.role` of that row).
  const seriesTarget = routineId != null && tagScope === "all";
  const tagTargetId = seriesTarget ? routineId : item.id;
  const tagTargetRole = seriesTarget ? "routine" : "event";

  const editorLabels = {
    title: t("scheduleScreen.title"),
    date: t("scheduleScreen.date"),
    allDay: t("scheduleScreen.allDay"),
    startTime: t("scheduleScreen.startTime"),
    endTime: t("scheduleScreen.endTime"),
    memo: t("scheduleScreen.memo"),
    save: t("scheduleScreen.save"),
    seriesHint: t("scheduleScreen.seriesEditHint"),
    originRoutine: t("scheduleScreen.originRoutine"),
    skipThisDay: t("scheduleScreen.skipThisDay"),
    delete: t("scheduleScreen.delete"),
  };

  /*
   * The reminder choices (#1374). Built here rather than in the pane because
   * copy is the host's (§6.4), and every t() call is written out LITERALLY —
   * shared/tests/i18nKeys.test.ts scans for literal `t("…")`, and a key held
   * in a table is invisible to it.
   */
  const reminder: EventEditorReminder = {
    label: t("scheduleScreen.reminder"),
    options: [
      { value: null, label: t("schedule.reminderNone") },
      ...REMINDER_LEAD_CHOICES.map((n) => ({
        value: n as number | null,
        label: t("schedule.reminderLead", { n }),
      })),
    ],
  };

  /*
   * Logged work time (#1375, typed since #2407). The copy lives here for the
   * §6.4 reason every other string on this screen does.
   *
   * `totalMinutes` is null until the read has landed. A loading or failed read
   * must not offer the field: the hand-entered row is the total minus the
   * timer's share, so a number saved without knowing that share would be wrong.
   */
  const workReady = workRead.status === "ready";
  const timerMinutes = workReady ? workRead.timerMinutes : 0;
  const workTime: EventEditorWorkTime = {
    label: t("scheduleScreen.workTime"),
    placeholder:
      workRead.status === "loading"
        ? t("common.loading")
        : t("scheduleScreen.workTimePlaceholder"),
    unit: t("scheduleScreen.workTimeUnit"),
    totalMinutes: workReady ? workRead.totalMinutes : null,
    timerMinutes,
    belowTimerMessage: t("scheduleScreen.workTimeBelowTimer", {
      n: timerMinutes,
    }),
    notWholeMessage: t("scheduleScreen.workTimeNotWhole"),
    loadFailedMessage:
      workRead.status === "failed"
        ? t("scheduleScreen.workTimeLoadFailed")
        : undefined,
    onSave: (totalMinutes, anchor) =>
      saveWorkTotal(totalMinutes, anchor, {
        date: item.date,
        startTime: item.startTime,
        isAllDay: item.isAllDay,
      }),
  };

  return (
    <EventEditorPane
      item={item}
      // #995 turned this on for the sheet alone, because Desktop's <Modal>
      // had no scroller for `sticky` to resolve against. #1728 gave the
      // overlay one, so the row pins on both widths — which is what keeps
      // Save on screen at 1440x900 when the repeat section unfolds its
      // weekday pills instead of only keeping it scrollable-to.
      stickyFooter
      // #1664: two columns on Desktop, one on the sheet — the sheet is ~360px
      // wide, where a second column is two unusable half-fields.
      twoColumn={isWide}
      labels={editorLabels}
      handlers={handlers}
      options={options}
      repeat={repeat}
      reminder={reminder}
      workTime={workTime}
      // #998 put this on the narrow sheet only, leaving Desktop to the
      // single-click bubble (#625). #1405 opens it on both widths: the Todo
      // side has had "convert to Event" INSIDE its edit panel all along
      // (ScheduleTodoDetail), so an Event whose panel offered nothing read as
      // "no way back" — the bubble is a separate gesture the user has to know
      // about. Same handler either way; the host still answers the routine
      // refusal (D-20260810-sched-5) and the undo entry (#997) itself.
      convert={{
        label: t("itemConvert.toTodo"),
        onConvert: onConvertToTodo,
      }}
      // #2031: the same entries as the Desktop bubble (#2005) — two when the
      // event has tags, one when it has none.
      duplicate={
        onDuplicate
          ? {
              entries:
                duplicateTagCount > 0
                  ? [
                      {
                        key: "withTags",
                        label: t("scheduleScreen.duplicateWithTags"),
                        onDuplicate: (id) =>
                          onDuplicate(id, { withTags: true }),
                      },
                      {
                        key: "withoutTags",
                        label: t("scheduleScreen.duplicateWithoutTags"),
                        onDuplicate: (id) =>
                          onDuplicate(id, { withTags: false }),
                      },
                    ]
                  : [
                      {
                        key: "duplicate",
                        label: t("scheduleScreen.duplicate"),
                        onDuplicate: (id) => onDuplicate(id),
                      },
                    ],
            }
          : undefined
      }
      // #2407: Delete / Cancel / Save, as in the prototype.
      cancel={onCancel ? { label: t("common.cancel"), onCancel } : undefined}
      // #2447: staged picks ride the save press and the discard question.
      tagDraft={{ dirty: tagDraft.dirty, onSave: tagDraft.save }}
      tagSlot={
        // #468: tagging is what files a row into a calendar, so without this
        // the lens above would have nothing to find. A routine occurrence is
        // tagged through its SERIES (the routine id): the occurrence rows are
        // regenerated, so a tag on one of them would go missing the moment the
        // generator re-materialises the range — and the user thinks of the
        // series as the thing anyway (#185 presents Routine as "an Event with
        // a repeat"). The role follows the id we actually write against, so it
        // matches `items_meta.role` of that row rather than what the UI calls
        // it.
        //
        // #2219: the colour row only says, and picks, WHICH tag colours the
        // event. Changing the tag's own colour moved to the Connect screen's
        // tag editor — from here it repainted every item wearing the tag.
        <div className="flex flex-col gap-1.5">
          {/*
           * #1663: which occurrences a tag (and therefore the colour it
           * paints) applies to. Only a repeat has the question at all, so a
           * single event never sees the control.
           *
           * "すべての回" writes against the SERIES — what #1632 settled, and
           * still the default, because a tag usually describes the thing that
           * repeats. "この回のみ" writes against this occurrence's own row,
           * which the colour resolution prefers over the series (see
           * eventTagColor in scheduleViewModels).
           *
           * "この回以降" is NOT here: nothing in the schema can bound a tag to
           * a date range, so it would have to mean "every occurrence already
           * on the calendar", and the days generated later would quietly miss
           * it. Filed as a decision rather than guessed at.
           */}
          {routineId != null && (
            <SegmentedControl
              options={[
                { id: "all", label: t("scheduleScreen.tagScopeAll") },
                { id: "this", label: t("scheduleScreen.tagScopeThis") },
              ]}
              value={tagScope}
              onChange={(id) => setTagScope(id as "all" | "this")}
              label={t("scheduleScreen.tagScopeLabel")}
              singleLineLabels
            />
          )}
          {/* #2219: 「ノートを添付」 at the right end of the tag row. The note
              links to this occurrence's own row, as the create panel's does —
              a note is about the day, not the series.
              #2479: below the breakpoint the picker takes the whole first
              line and 「ノートを添付」 drops to the next one, kept at the
              right end (its panel opens leftward from there). Sharing a
              390px line, a one-tag picker was left ~165px and its 「＋」
              wrapped onto a line of its own. */}
          <div
            data-event-tag-row=""
            className="flex items-start gap-2 max-md:flex-wrap"
          >
            <div
              data-event-tag-picker=""
              className="min-w-0 flex-1 max-md:basis-full"
            >
              <TagPicker
                itemId={tagTargetId}
                itemRole={tagTargetRole}
                staged={tagDraft.stagedFor(tagTargetId)}
              />
            </div>
            {noteAttach && (
              <div
                data-event-note-attach=""
                className="shrink-0 max-md:ml-auto"
              >
                <ItemNoteAttach
                  notes={noteAttach.notes}
                  onAttach={(draft) => noteAttach.onAttach(item.id, draft)}
                  onOpenChange={noteAttach.onOpenChange}
                  labels={noteAttachLabels}
                />
              </div>
            )}
          </div>
          {/* #2407: the link to the tag's own colour, which #2219 moved to
              Connect's tag editor. */}
          <TagColorControls itemId={tagTargetId} onOpenTag={onOpenTag} />
        </div>
      }
    />
  );
}
