import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Trash2 } from "lucide-react";
import type { TodoStatus } from "../types/todoTree";
import { AllDayCheck } from "./schedule/AllDayCheck";
import {
  WorkTimeField,
  hasHandEnteredTime,
  readWorkTimeDraft,
  type WorkTimeModel,
} from "./schedule/WorkTimeField";
import { TimeRangeField } from "./TimeRangeField";
import { TodoStatusCheckbox } from "./TodoStatusCheckbox";
import type { StatusLabelSet } from "./todoStatusVisuals";
import { isImeComposing } from "../utils/imeGuard";
import { timedSpanForAllDayOff } from "../utils/scheduleAllDay";
import type { TodoScheduleSlot } from "../utils/todoCalendarChips";
import type { EventWorkAnchor } from "../utils/timerSessions";
import { cn } from "./cn";
import { useDetailFrameBody } from "./ResponsiveDetailFrame";
import {
  DISABLED_FILLED_BTN,
  FIELD,
  FOCUS_RING,
  FOCUS_RING_ON_ACCENT,
  FOCUS_RING_TIGHT,
} from "./styleTokens";

/*
 * Todo detail panel (W7). The selected todo's detail, which the Kanban host
 * pushes into the shared rightSidebar via <RightSidebarPortal> (the W6
 * MasterDetail two-pane part was retired in code-reduction #346) on Desktop,
 * and into the MobileTodoList bottom sheet on Mobile (#470) — one panel, two
 * surfaces, so a field added here reaches both. Schedule renders the same panel
 * for a todo chip (#626), which is why the save model below has to be the
 * panel's own rather than either host's.
 * Pure presentation, DataService-free (§3.1): every
 * mutation is a callback the host injects (onSave / onToggleStatus),
 * the rich-text editor is injected as `contentEditor` (TipTap is a web
 * dependency and must not be pulled into shared), and all copy arrives as
 * already-translated props (§6.4 — no useTranslation here). lumen-* tokens
 * only; the panel container is opaque (§5).
 *
 * SAVE BUTTON (#713, Epic #627 段階 1 — ユーザー裁定 D-20260810-sched-1 = A).
 * The title used to persist on a 300ms debounce with a blur and unmount flush,
 * and the injected body editor on an 800ms one. Both wrote while the user was
 * still typing, and Schedule's own detail pane had already moved to a button
 * (#628) — so the same panel confirmed one way and the pane beside it another.
 * Now the title is a draft, the host reports the body's pending state through
 * `contentDirty`, and ONE press commits both: the panel sends its title patch
 * and the host folds in whatever the editor is holding, so a title + body edit
 * is a single write rather than two racing ones.
 *
 * Closing without the button discards, and that is the point — nothing is
 * written behind the user's back any more. It is not thrown away in silence
 * either (#736): the panel reports its pending state through `onDirtyChange`,
 * and both hosts ask before any exit that tears the panel down.
 *
 * DELETE (#775). Optional, and off unless the host passes BOTH `onDelete` and
 * `deleteLabel`: on Mobile the detail sheet is the only way into a todo at
 * all. The affordance copies <EventEditorPane>'s delete (danger text +
 * Trash2): the two panels open from the same day list, and a user who has
 * deleted an event should recognise the control on a todo.
 *
 * #2219 moved it into the save footer, at its LEFT end — where the event
 * pane put its own in #2080. It used to be a row of its own above the footer,
 * so the two panels placed the same control in two different spots. The
 * mis-tap worry that kept it out is answered by the opposite ends: borderless
 * danger text on the left, the one accent-filled control on the right.
 *
 * The panel does not ask before firing — the confirm belongs to the host, which
 * is the only side that knows what the delete drags along (the subtree cascade)
 * and how to put the question on screen (#707's in-app <ConfirmDialog>).
 *
 * The status toggle is NOT drafted (#713 対象外): it is a discrete act, not a
 * field that can be half-typed.
 *
 * #2219: the toggle is the app's round <TodoStatusCheckbox> (#2217 gives every
 * todo completion that one shape). It used to be a ○ / ● glyph in a bordered
 * button — the one todo checkbox that looked like none of the others.
 *
 * #2401: everything about a todo can be edited here, in the order the design
 * lists it: name, status, date and time, goals, tags, memo, then Delete, Cancel
 * and Save. The date and time are a draft like the title, so the same press
 * writes them and the unsaved guard covers them. A name left empty cannot be
 * saved, whichever half of the panel is pending.
 *
 * #2553: the same two columns as the event editor on Desktop (#1664), so a
 * todo and an event opened from the same day put the same things in the same
 * places — what the todo IS (name, day and time) on the left, what is attached
 * to it (tags, colour, memo, goals, status, logged time) on the right. The
 * convert / open actions and the footer run full width under both. The status
 * takes the two-choice row on both widths, and the todo gains the event's
 * logged-time field (`workTime`), written to the same timer log.
 */

/** What one press of the save button changes (#713). */
export interface TodoDetailPatch {
  title?: string;
  /**
   * The new day and time (#2401); null takes the todo off the calendar. Absent
   * when the row did not move. On an all-day slot the two times mean nothing.
   */
  schedule?: TodoScheduleSlot | null;
}

/** Already-translated words of the date and time row (§6.4, #2401). */
export interface TodoScheduleLabels {
  /** The row's caption, 「日時」. */
  caption: string;
  date: string;
  allDay: string;
  start: string;
  end: string;
}

export interface TodoDetailPanelProps {
  /** Selected node id — also keys the draft, so a todo switch re-seeds it. */
  todoId: string;
  /** Current title (the draft sits on top of it). */
  title: string;
  /** Current status. */
  status?: TodoStatus;
  /**
   * Commit the pending draft (#713). Fires only from the save button (or Enter
   * in the title), carrying the title when it changed. The host writes it
   * together with whatever the injected content editor is holding — one press,
   * one update.
   */
  onSave: (id: string, patch: TodoDetailPatch) => void;
  /**
   * The injected content editor holds unsaved changes. The body draft lives in
   * the host (the editor is a web dependency), so the panel cannot see it —
   * without this the button would sit disabled while the body was pending, and
   * the only edit the user could not save would be the long one.
   */
  contentDirty?: boolean;
  /**
   * Report whether anything is pending, for hosts whose close affordances need
   * to ask before discarding (same contract as EventEditorPane's #628 flag).
   * Fires with `false` on unmount — which is what lets a host leave its own
   * flag alone on an agreed discard and still not go stale (#736).
   */
  onDirtyChange?: (dirty: boolean) => void;
  /** Toggle the todo status (host injects the toggle). */
  onToggleStatus?: (id: string) => void;
  /**
   * Soft-delete the todo (#775). Fires RAW: the host owns the confirm, the
   * cascade count and the close that follows. Rendered only together with
   * `deleteLabel`, so a host cannot ship the button without a name for it.
   */
  onDelete?: (id: string) => void;
  /**
   * Replaces the built-in checkbox with a host-supplied status control — the
   * touch <TodoStatusChoices> row on Mobile (#470). The caption still comes
   * from `statusLabel`, and the row stacks (caption above) so the choices get
   * the full width. Omitting it keeps the Desktop checkbox unchanged.
   */
  statusControl?: ReactNode;
  /** Injected rich-text editor (host wires key={todoId} for remount). */
  contentEditor?: ReactNode;
  /** Already-translated aria-label for the title input (§6.4). */
  titleLabel: string;
  /** Already-translated caption preceding the status control. */
  statusLabel: string;
  /** Already-translated label for the current status value. */
  statusText?: string;
  /**
   * Already-translated per-status words for the checkbox's accessible name
   * (#2219 — "Status: Done"). Omitted, the name falls back to `statusText`,
   * which is the word for the status the todo is in.
   */
  statusLabels?: StatusLabelSet;
  /** Already-translated caption above the content editor. */
  contentLabel?: string;
  /** Primary action — "保存" (#713). */
  saveLabel: string;
  /** Already-translated name for the delete button (#775). Pair with
   *  `onDelete`; when either is absent the delete row is omitted. */
  deleteLabel?: string;
  /**
   * The footer's Cancel (#2401). Fires raw: the host closes the panel, and asks
   * first when something is pending. Rendered only with `cancelLabel`.
   */
  onCancel?: () => void;
  cancelLabel?: string;
  /**
   * Where the todo sits on the calendar (#2401), or null when it has no day.
   * The host reads it with `todoScheduleSlot`, the helper the chips are built
   * from, so this row and the chip cannot disagree.
   *
   * The row used to be read-only (#877), on the argument that placing a todo is
   * a drag on the calendar. The Goals & Todos screen edits a todo with no
   * calendar in sight, so that left the day and the time out of reach there.
   */
  schedule?: TodoScheduleSlot | null;
  /** The row's words. Drawn only when given, so a host opts in as a pair. */
  scheduleLabels?: TodoScheduleLabels;
  /** Formats the duration beside the end times (TimeRangeField). */
  formatDuration?: (minutes: number) => string;
  /** Already-translated caption preceding the tag row (§6.4). Paired with
   *  `tagsSlot`; when either is absent the tag row is omitted. */
  tagsLabel?: string;
  /** Host-injected tag chips (e.g. the todo's assigned WikiTags). Additive —
   *  existing callers that omit it keep the original title/status/content
   *  layout unchanged. Rendered between the status row and the content editor. */
  tagsSlot?: ReactNode;
  /**
   * #2219: a control at the RIGHT end of the tag row — 「ノートを添付」. Drawn
   * only with the tag row itself, so it never floats on a row of its own.
   */
  tagsTrailing?: ReactNode;
  /**
   * #2219: the row under the tags that says, and picks, which tag colours the
   * todo (TagColorControls). Separate from `tagsSlot` because the chips wrap
   * on one line and this is a block of its own.
   */
  colorSlot?: ReactNode;
  /**
   * The goal field (#2109, plan Step 10): host-injected, because the goals,
   * their links and the write live with the host (the field itself is the
   * shared <GoalPickerField>). Paired like the tag row — omitted unless both
   * are given, so a todo with no goals to offer shows no empty caption.
   */
  goalsLabel?: string;
  goalsSlot?: ReactNode;
  /**
   * The goal draft differs from the saved links. Folded into the save button
   * like `contentDirty`: the links are written by the same press, so they
   * must be able to light it on their own.
   */
  goalsDirty?: boolean;
  /**
   * Pin the save footer to the bottom of the frame's scroller (#995).
   *
   * A PROP rather than a class the host appends to `className`: `cn` is plain
   * concatenation (rules/frontend.md §Gotchas), so a `sticky` arriving that
   * way would be settled by emission order rather than by the caller.
   *
   * Narrow-only until #1728, because Desktop's <Modal> had no scroller for
   * `sticky` to resolve against — it would have resolved against the VIEWPORT
   * and lifted the footer off the card once the dialog outgrew the window.
   * `fitViewport` gave the overlay that scroller, so a host on either width
   * may now ask for the pin. Still opt-in: a frame WITHOUT a scrolling
   * ancestor must not.
   */
  stickyFooter?: boolean;
  /**
   * Lay the fields out in TWO columns (#2553), as the event editor does on
   * Desktop (#1664). A prop for the reason `twoColumn` is one there: the host
   * knows which frame it is mounting, and the sheet is too narrow for two.
   */
  twoColumn?: boolean;
  /**
   * Logged work time (#2553) — the event editor's field, against the todo.
   * Omitted, no field. The anchor handed to `onSave` carries an empty date
   * for a todo with no day; the host decides which day the row sits on then.
   */
  workTime?: WorkTimeModel;
  /**
   * Full-width actions between the fields and the footer (#2553) — 「予定に変換」
   * and 「予定の画面で開く」. Inside the panel so they sit above the footer's rule,
   * where the event editor keeps its convert.
   */
  actions?: ReactNode;
  className?: string;
}

// #2476: on a phone the footer is tighter than its three labels, and a flex
// item that may shrink folds its own text ("キャンセ / ル"). Each footer button
// keeps its label on one line and the ROW wraps instead (`max-md:flex-wrap` on
// the footer). Narrow-only, so the Desktop footer is untouched.
const NARROW_NO_FOLD = "max-md:shrink-0 max-md:whitespace-nowrap";

// Disabled whenever there is nothing to save, which is most of the time the
// panel is open — so the filled recess (#1803), not a faded accent.
const SAVE_BTN = cn(
  "rounded-md bg-lumen-accent px-3 py-1.5 text-sm font-medium text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover max-md:min-h-11",
  NARROW_NO_FOLD,
  FOCUS_RING_ON_ACCENT,
  DISABLED_FILLED_BTN,
);

/*
 * #2553: an accent ring while the press would write something — the
 * prototype's cue that the panel holds changes. A ring (box-shadow) rather than
 * a border so nothing reflows when it comes and goes, offset onto the card's
 * own token so the gap matches the surface (FOCUS_RING_ON_ACCENT is an outline,
 * so the focus cue still draws on top of it).
 */
const SAVE_READY =
  "ring-2 ring-lumen-accent ring-offset-2 ring-offset-lumen-bg-secondary";

// Outlined beside the filled Save, as on the event pane (#2407).
const CANCEL_BTN = cn(
  "rounded-md border border-lumen-border-strong px-3 py-1.5 text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover max-md:min-h-11",
  NARROW_NO_FOLD,
  FOCUS_RING_TIGHT,
);

/*
 * The date row's draft. A todo with no day starts as "all day" once a date is
 * picked: a date alone says nothing about a time, and it is the shape the
 * tray's "add to today" writes. The empty times make the all-day check hand
 * back the 09:00–10:00 default rather than the slot's "00:00" placeholders.
 */
const NO_SCHEDULE: TodoScheduleSlot = {
  date: "",
  startTime: "",
  endTime: "",
  isAllDay: true,
};

function scheduleDraftOf(
  slot: TodoScheduleSlot | null | undefined,
): TodoScheduleSlot {
  if (!slot) return NO_SCHEDULE;
  return slot.isAllDay ? { ...slot, startTime: "", endTime: "" } : slot;
}

/** Same day and time? An empty date has no time, an all-day slot neither. */
function sameSchedule(a: TodoScheduleSlot, b: TodoScheduleSlot): boolean {
  if (a.date !== b.date) return false;
  if (!a.date) return true;
  if (a.isAllDay !== b.isAllDay) return false;
  return a.isAllDay || (a.startTime === b.startTime && a.endTime === b.endTime);
}

/** Inner fields, keyed by todoId from the panel so a todo switch drops the
 *  pending edits cleanly (same arrangement as EventEditorPane). */
function TodoDetailFields({
  todoId,
  title,
  status,
  onSave,
  contentDirty = false,
  onDirtyChange,
  onToggleStatus,
  onDelete,
  statusControl,
  contentEditor,
  titleLabel,
  statusLabel,
  statusText,
  statusLabels,
  contentLabel,
  saveLabel,
  deleteLabel,
  onCancel,
  cancelLabel,
  schedule,
  scheduleLabels,
  formatDuration,
  tagsLabel,
  tagsSlot,
  tagsTrailing,
  colorSlot,
  goalsLabel,
  goalsSlot,
  goalsDirty = false,
  stickyFooter,
  twoColumn = false,
  workTime,
  actions,
  framed,
}: Omit<TodoDetailPanelProps, "className"> & {
  /** The frame is the card (#2660); see TodoDetailPanel. */
  framed: boolean;
}) {
  // `undefined` = untouched, so the field keeps following the live todo and a
  // rename made elsewhere still lands in front of the user instead of being
  // quietly pushed back by a stale draft (EventEditorEdits, same reasoning).
  const [titleEdit, setTitleEdit] = useState<string | undefined>(undefined);
  const draftTitle = titleEdit ?? title;
  const titleDirty = titleEdit !== undefined && titleEdit !== title;
  // Same idiom: dropping the todo onto the calendar while the panel is open
  // moves an untouched row with it.
  const [scheduleEdit, setScheduleEdit] = useState<
    TodoScheduleSlot | undefined
  >(undefined);
  const savedSchedule = scheduleDraftOf(schedule);
  const draftSchedule = scheduleEdit ?? savedSchedule;
  const scheduleDirty =
    scheduleEdit !== undefined && !sameSchedule(scheduleEdit, savedSchedule);
  // The logged time (#2553), a draft like the rest. Kept apart from the patch
  // because it goes to the timer log, not to the todo's row.
  const [workTimeEdit, setWorkTimeEdit] = useState<string | undefined>(
    undefined,
  );
  const workTimeDraft = workTime
    ? readWorkTimeDraft(workTime, workTimeEdit)
    : null;
  const workTimeDirty = workTimeDraft?.dirty === true;
  const dirty =
    titleDirty || contentDirty || goalsDirty || scheduleDirty || workTimeDirty;
  // Still dirty, so the guard asks; only the press is held back.
  const nameEmpty = draftTitle.trim() === "";
  const canSave = dirty && !nameEmpty && !workTimeDraft?.problem;
  const resolvedStatus = status ?? "NOT_STARTED";

  // Same ref dance as EventEditorPane: the unmount report must not pin a stale
  // callback, and refreshing it in an effect (not during render) is what
  // react-hooks/refs asks for.
  const onDirtyChangeRef = useRef(onDirtyChange);
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  });
  useEffect(() => {
    onDirtyChangeRef.current?.(dirty);
  }, [dirty]);
  useEffect(() => () => onDirtyChangeRef.current?.(false), []);

  const save = () => {
    if (!canSave) return;
    // The host is told even when only the BODY moved: it is the one holding
    // that draft, and the press is the only signal it gets.
    const patch: TodoDetailPatch = {};
    if (titleDirty) patch.title = draftTitle;
    if (scheduleDirty) patch.schedule = draftSchedule.date ? draftSchedule : null;
    // #2553: before the patch, as on the event editor (#2407). A press that
    // only moves the todo still writes, or the hand-entered row would go on
    // counting toward the day the todo left.
    if (workTime && workTimeDraft) {
      if (
        workTimeDraft.dirty ||
        (scheduleDirty && hasHandEnteredTime(workTime))
      ) {
        const anchor: EventWorkAnchor = {
          date: draftSchedule.date,
          startTime: draftSchedule.isAllDay ? "" : draftSchedule.startTime,
          isAllDay: draftSchedule.isAllDay,
        };
        workTime.onSave(workTimeDraft.totalMinutes, anchor);
      }
      setWorkTimeEdit(undefined);
    }
    onSave(todoId, patch);
    // Back to following the live todo, which the write has just moved.
    setScheduleEdit(undefined);
  };

  const editSchedule = (patch: Partial<TodoScheduleSlot>) =>
    setScheduleEdit({ ...draftSchedule, ...patch });

  const toggleAllDay = () => {
    if (!draftSchedule.isAllDay) {
      editSchedule({ isAllDay: true });
      return;
    }
    // Times still in the draft are the span all-day was turned on over, and an
    // end before its start is an overnight todo. Handing them to the helper
    // would cut that to an hour, so on and off would read as a change. Only a
    // draft with no times (a saved all-day, a first date) asks it for a span.
    editSchedule(
      draftSchedule.startTime && draftSchedule.endTime
        ? { isAllDay: false }
        : {
            isAllDay: false,
            ...timedSpanForAllDayOff(
              draftSchedule.startTime,
              draftSchedule.endTime,
            ),
          },
    );
  };

  const saveOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    // IME guard: the Enter that CONFIRMS a Japanese conversion is not a save.
    // `isComposing` alone misses exactly that keypress on WebKit (#737) — the
    // shared helper is what knows both halves of the answer.
    if (e.key === "Enter" && !isImeComposing(e)) {
      e.preventDefault();
      save();
    }
  };

  const titleField = (
    <>
      <input
        value={draftTitle}
        onChange={(e) => setTitleEdit(e.target.value)}
        onKeyDown={saveOnEnter}
        aria-label={titleLabel}
        aria-invalid={nameEmpty || undefined}
        className={cn(
          "w-full rounded-md border border-lumen-border bg-lumen-bg px-2 py-1.5 text-sm font-medium text-lumen-text max-md:min-h-11 max-md:text-base",
          FOCUS_RING,
        )}
      />
    </>
  );
  const statusRow = (
    <>
      <div
        className={cn(
          "flex",
          // Both branches name their own gap: cn is a plain joiner (no
          // tailwind-merge), so a base "gap-2" would survive alongside
          // "gap-1.5" and the CSS output order — not the class order — would
          // pick the winner.
          statusControl
            ? "flex-col items-stretch gap-1.5"
            : "items-center gap-2",
        )}
      >
        <span className="text-xs uppercase tracking-wide text-lumen-text-secondary">
          {statusLabel}
        </span>
        {statusControl ?? (
          // #873: two values, so the control is a checkbox — a press sets
          // done / not done rather than advancing through a cycle. The host's
          // toggle decides the next value, as it always has.
          <span className="inline-flex items-center gap-0.5">
            <TodoStatusCheckbox
              status={resolvedStatus}
              onChange={() => onToggleStatus?.(todoId)}
              labels={
                statusLabels ?? {
                  statusNotStarted: statusText ?? "",
                  statusDone: statusText ?? "",
                }
              }
              label={statusLabel}
              // The 44px target stays; the margin keeps the row its height.
              className="-my-2.5 -ml-2.5"
            />
            <span aria-hidden className="text-sm text-lumen-text">
              {statusText}
            </span>
          </span>
        )}
      </div>
    </>
  );
  const scheduleRow = (
    <>
      {/* #2401: the schedule row, a draft like the title. Same caption treatment
            as the status above it, and directly under it, because the two answer
            the pair of questions a list raises: how far along, and when. The times
            and the all-day check wait for a date, since neither means anything
            without one. An emptied date is a real answer here (the todo goes back
            to having no day), unlike the event pane, whose row must keep one. */}
      {scheduleLabels && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-lumen-text-secondary">
            {scheduleLabels.caption}
          </span>
          {/* `min-w-0` + `appearance-none` on the input: WebKit otherwise holds
                a date input at its own width, under the check beside it (#1403).
                No Enter-to-save here: a half-typed date is a live draft, so a
                cleared month reads "" (off the calendar) and a one-digit year
                reads 1902. */}
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={draftSchedule.date}
              onChange={(e) => editSchedule({ date: e.target.value })}
              aria-label={scheduleLabels.date}
              className={cn(
                FIELD,
                "min-w-0 flex-1 appearance-none tabular-nums max-md:min-h-11 max-md:text-base",
              )}
            />
            {draftSchedule.date && (
              <AllDayCheck
                checked={draftSchedule.isAllDay}
                onToggle={toggleAllDay}
                label={scheduleLabels.allDay}
              />
            )}
          </div>
          {draftSchedule.date && !draftSchedule.isAllDay && (
            <TimeRangeField
              start={draftSchedule.startTime}
              end={draftSchedule.endTime}
              onChange={(next) =>
                editSchedule({ startTime: next.start, endTime: next.end })
              }
              labels={{ start: scheduleLabels.start, end: scheduleLabels.end }}
              formatDuration={formatDuration}
              allowOvernight
            />
          )}
        </div>
      )}
    </>
  );
  const goalsRow = (
    <>
      {/* #2109: stacked, caption above — the field is a list, not a chip
            row, and needs the panel's full width on a phone. */}
      {goalsLabel && goalsSlot != null && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-lumen-text-secondary">
            {goalsLabel}
          </span>
          {goalsSlot}
        </div>
      )}
    </>
  );
  const tagRows = (
    <>
      {tagsSlot != null && (
        <div className="flex items-start gap-2">
          {tagsLabel && (
            <span className="pt-1 text-xs uppercase tracking-wide text-lumen-text-secondary">
              {tagsLabel}
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {tagsSlot}
          </div>
          {tagsTrailing}
        </div>
      )}
      {tagsSlot != null && colorSlot}
    </>
  );
  const memoRow = (
    <>
      {contentEditor && (
        <div className="space-y-1">
          {contentLabel && (
            <span className="text-xs uppercase tracking-wide text-lumen-text-secondary">
              {contentLabel}
            </span>
          )}
          {contentEditor}
        </div>
      )}
    </>
  );
  const workTimeRow = workTime && workTimeDraft && (
    <WorkTimeField
      workTime={workTime}
      draft={workTimeDraft}
      onEdit={setWorkTimeEdit}
      onKeyDown={saveOnEnter}
    />
  );

  /*
   * #2553: on Desktop, the event editor's two columns (#1664) — what the todo
   * IS on the left, what is attached to it on the right, with the goals kept
   * just above the status as the Issue placed them. On the sheet, the #2401
   * order, with the logged time after the memo.
   */
  return (
    <>
      {twoColumn ? (
        <div className="flex items-start gap-4">
          {/* Named in the DOM so a suite can ask which column a field landed
              in — jsdom has no layout (same attribute as the event editor). */}
          <div
            data-editor-column="identity"
            className="flex min-w-0 flex-1 flex-col gap-3"
          >
            {titleField}
            {scheduleRow}
          </div>
          <div
            data-editor-column="attachments"
            className="flex min-w-0 flex-1 flex-col gap-3"
          >
            {tagRows}
            {memoRow}
            {goalsRow}
            {statusRow}
            {workTimeRow}
          </div>
        </div>
      ) : (
        <>
          {titleField}
          {statusRow}
          {scheduleRow}
          {goalsRow}
          {tagRows}
          {memoRow}
          {workTimeRow}
        </>
      )}

      {/* Full width under both columns: they act on the whole todo, and in a
          column they would read as belonging to that column's fields. */}
      {actions != null && <div className="flex flex-col gap-2">{actions}</div>}

      {/* Save footer (#713) — the only commit. Disabled while there is nothing
          to write (#434 S-1). #2219: the 「保存済み / 未保存」 line beside it is
          gone (the button's state says it), and Delete (#775) rides the left
          end, as on the event pane. */}
      <div
        className={cn(
          "flex items-center justify-end gap-3 border-t border-lumen-border pt-3 max-md:flex-wrap",
          // Opaque, and the CARD's own token, so the fields scroll UNDER the
          // pinned row rather than showing through it (§5 bans transparency on
          // a primary surface anyway).
          //
          // No z-index on purpose: TagPicker's popover and TimeRangeField's
          // listbox are `absolute z-20`, and a footer above them would bury an
          // open dropdown. Last-in-DOM already puts it over ordinary flow.
          //
          // `-mb-3 pb-3` is height-neutral — the negative margin gives back
          // exactly what the padding adds. It exists so the pinned row keeps
          // the card's own breathing room instead of sitting flush on the
          // scroll edge. Framed (#2660) the panel has no padding to borrow
          // from; the frame's own padding sits below the scroller instead.
          stickyFooter && "sticky bottom-0 bg-lumen-bg-secondary",
          stickyFooter && !framed && "-mb-3 pb-3",
        )}
      >
        {/* min-h-lumen-tap-min is the project's hit-area floor (tokens.css) —
            the CSS `:has()` rule that applies it for free only reaches
            icon-ONLY buttons, and this one carries a label too. */}
        {onDelete && deleteLabel && (
          <button
            type="button"
            onClick={() => onDelete(todoId)}
            className={cn(
              "mr-auto flex min-h-lumen-tap-min items-center gap-1.5 rounded-sm text-sm font-medium text-lumen-danger max-md:min-h-11",
              NARROW_NO_FOLD,
              FOCUS_RING,
            )}
          >
            <Trash2 aria-hidden className="size-3.5" />
            {deleteLabel}
          </button>
        )}
        {onCancel && cancelLabel && (
          <button type="button" onClick={onCancel} className={CANCEL_BTN}>
            {cancelLabel}
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className={cn(SAVE_BTN, canSave && SAVE_READY)}
        >
          {saveLabel}
        </button>
      </div>
    </>
  );
}

export function TodoDetailPanel({ className, ...rest }: TodoDetailPanelProps) {
  // #2660: inside a ResponsiveDetailFrame, with a Cancel to stand in for the
  // frame's ×, the frame becomes this card — drawing it here too was the
  // second outline. The Cancel is drawn only when both halves are passed.
  const framed = useDetailFrameBody(Boolean(rest.onCancel && rest.cancelLabel));
  return (
    <div
      className={cn(
        "space-y-3",
        framed
          ? null
          : "rounded-md border border-lumen-border bg-lumen-bg-secondary p-3",
        className,
      )}
    >
      {/* Keyed on the id: pending edits belong to the todo they were typed
          against, so switching todos drops them via a remount. The fragment
          adds no element, so the container's space-y still spaces the fields. */}
      <TodoDetailFields key={rest.todoId} {...rest} framed={framed} />
    </div>
  );
}
