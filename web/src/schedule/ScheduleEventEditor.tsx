import {
  EventEditorPane,
  REMINDER_LEAD_CHOICES,
  useTranslation,
  type EventEditorHandlers,
  type EventEditorItem,
  type EventEditorOptions,
  type EventEditorReminder,
  type EventEditorRepeat,
  type EventEditorWorkTime,
} from "@life-editor/shared";
import { TagPicker } from "../wikitag/TagPicker";
import { TagColorControls } from "../wikitag/TagColorControls";
import { useEventWorkTime } from "./useEventWorkTime";

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
}

export function ScheduleEventEditor({
  item,
  isWide,
  routineId,
  handlers,
  options,
  repeat,
  onConvertToTodo,
}: ScheduleEventEditorProps) {
  const { t } = useTranslation();
  // Before the early return — hooks cannot be called conditionally, and the
  // hook already treats a null id as "nothing to read".
  const workMinutes = useEventWorkTime(item?.id ?? null);

  if (!item) return null;

  const editorLabels = {
    title: t("scheduleScreen.title"),
    date: t("scheduleScreen.date"),
    allDay: t("scheduleScreen.allDay"),
    startTime: t("scheduleScreen.startTime"),
    endTime: t("scheduleScreen.endTime"),
    memo: t("scheduleScreen.memo"),
    save: t("scheduleScreen.save"),
    saved: t("scheduleScreen.saved"),
    unsaved: t("scheduleScreen.unsaved"),
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
   * Logged work time (#1375). The composition lives here for the §6.4 reason
   * every other string on this screen does — and it reuses the calendar's own
   * duration words rather than Analytics' "2h 30m", so the panel that says an
   * event runs 90 minutes says its logged time the same way.
   *
   * Rounded to whole minutes: sessions store seconds, and "1 hr 29.7 min" is
   * not a thing anyone wants to read. Zero — and a read that has not landed or
   * failed (`null`) — shows the "nothing logged" sentence rather than "0 min":
   * both mean "there is no logged time to show you", and a loading flicker in a
   * panel that opens instantly would be noise rather than information.
   *
   * Written out inline rather than as a helper taking `t`: the catalog keys are
   * a TYPE here (i18next's key union), so a helper would have to widen `t` back
   * to `(key: string) => string` and give up the compile-time key check.
   */
  const loggedMinutes = Math.round(workMinutes ?? 0);
  const loggedHours = Math.floor(loggedMinutes / 60);
  const loggedRest = loggedMinutes % 60;
  const workTime: EventEditorWorkTime = {
    label: t("scheduleScreen.workTime"),
    value:
      loggedMinutes <= 0
        ? t("scheduleScreen.workTimeNone")
        : loggedHours === 0
          ? t("scheduleScreen.durationMin", { m: loggedRest })
          : loggedRest === 0
            ? t("scheduleScreen.durationHour", { h: loggedHours })
            : t("scheduleScreen.durationHourMin", {
                h: loggedHours,
                m: loggedRest,
              }),
  };

  return (
    <EventEditorPane
      item={item}
      // #995: narrow only — Desktop's <Modal> has no scroller for `sticky` to
      // resolve against.
      stickyFooter={!isWide}
      labels={editorLabels}
      handlers={handlers}
      options={options}
      repeat={repeat}
      reminder={reminder}
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
        // #551: the color controls write the TAG's color (setTagColor) — an
        // item shows color only through its tags, so "change this item's
        // color" and "change this tag's color" are the same act, and the hue
        // updates everywhere that tag paints (pills, Kanban, lens chips).
        <div className="flex flex-col gap-1.5">
          <TagPicker
            itemId={routineId ?? item.id}
            itemRole={routineId != null ? "routine" : "event"}
          />
          <TagColorControls itemId={routineId ?? item.id} />
        </div>
      }
    />
  );
}
