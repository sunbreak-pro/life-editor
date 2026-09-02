import {
  EventEditorPane,
  REMINDER_LEAD_CHOICES,
  useTranslation,
  type EventEditorHandlers,
  type EventEditorItem,
  type EventEditorOptions,
  type EventEditorReminder,
  type EventEditorRepeat,
} from "@life-editor/shared";
import { TagPicker } from "../wikitag/TagPicker";
import { TagColorControls } from "../wikitag/TagColorControls";

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
   * Event → Todo, from the narrow sheet only (#998). The host owns both
   * questions the press can raise — the unsaved-draft discard and the routine
   * refusal — so this is handed the id and nothing else.
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
      // #998: narrow only. Desktop already reaches the conversion from the
      // single-click bubble (#625) — ScheduleOverlays draws that when isWide —
      // and a second entry inside the overlay would be a Desktop-visible change
      // this Issue does not ask for.
      convert={
        isWide
          ? undefined
          : {
              label: t("itemConvert.toTodo"),
              onConvert: onConvertToTodo,
            }
      }
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
