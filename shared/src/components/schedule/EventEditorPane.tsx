import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Repeat, Trash2 } from "lucide-react";
import { cn } from "../cn";
import { TimeRangeField } from "../TimeRangeField";
import { ScheduleStatusTag } from "./ScheduleStatusTag";
import {
  FrequencyEditor,
  type FrequencyEditorValue,
  type FrequencyEditorLabels,
} from "./FrequencyEditor";
import type { ScheduleStatus } from "../../utils/scheduleStatus";
import { timedSpanForAllDayOff } from "../../utils/scheduleAllDay";
import { seedFrequencyPatch } from "../../utils/routineFrequency";
import { isImeComposing } from "../../utils/imeGuard";
import {
  FIELD,
  FIELD_LABEL,
  FOCUS_RING_ON_ACCENT,
  FOCUS_RING_TIGHT,
} from "../styleTokens";

/*
 * EventEditorPane (W8 target-IA) — the selected-event editor. Backs the
 * Desktop detail overlay and the Mobile detail sheet. Pure presentation (§3.1 /
 * §6.4): copy injected already translated, every mutation is a callback.
 * lumen-* tokens only (§5).
 *
 * SAVE BUTTON (#628, Epic #627 段階 1 — ユーザー裁定 D-20260810-sched-1 = A).
 * Every field on this pane is a DRAFT and nothing reaches the host until the
 * save button is pressed. Blur writes nothing. That replaces the commit-on-blur
 * model this pane shipped with, where:
 *
 *   - "not committed yet" was invisible, and
 *   - Esc / a backdrop click threw some edits away and kept others (the date
 *     had an unmount flush, the rest did not), with no way to tell which.
 *
 * The date's unmount flush is RETIRED with that model rather than kept: it
 * existed only to rescue a blur-committed field from a dismissal that fires no
 * blur, and under "the button is the only commit" it would be a second, silent
 * write path — exactly the double-write the issue set out to remove. Losing an
 * unsaved draft on close is now the host's problem instead: it reads `dirty`
 * through `onDirtyChange` and confirms before it closes.
 *
 * ONE write per save (#553 / #279). The button hands the host a single patch of
 * everything that changed, so a routine occurrence's this/future/all scope
 * dialog is asked once no matter how many fields moved. The start/end pair is
 * still the shared <TimeRangeField>, which owns the start<end invariant; it now
 * writes into the draft instead of straight through to the host.
 *
 * NOT drafted, and deliberately so: the completion toggle, Dismiss and Delete.
 * They are discrete acts rather than field edits — nothing about them is "half
 * typed" — and each already answers for itself.
 *
 * The repeat section IS drafted since #712. It was the one control left
 * committing outside the button, which meant the same panel confirmed in two
 * different ways and "I never pressed save" could still have changed the
 * series. It edits a different row (the routine) through the host's conversion
 * guard (#407 / #434), so the button hands it over FIRST and then sends the
 * field patch — the order the pane had before, where a frequency write always
 * preceded the save press. The field patch is what raises the this/future/all
 * scope dialog (#279), so it stays last and is still asked exactly once.
 *
 * Issue 017 (routine ghost-revival): a routine-generated item is never
 * hard/soft-deleted as a single row — deleting it lets the generator revive
 * it. Since #279 the delete button renders for routine items too, but the
 * host routes it into the this/future/all scope dialog whose "this only"
 * choice performs a Dismiss (revival-safe). Dismiss ("skip this day") stays
 * routine-only; a manual item keeps the plain delete.
 *
 * Repeat section (#185 Step 3): when the host wires the repeat props
 * (`repeatLabels` + `repeatWeekdayLabels` + `onChangeRepeat`), every event
 * gains a "繰り返し" section backed by the shared <FrequencyEditor>. For a
 * routine-derived occurrence it replaces the old read-only "元 Routine" chip
 * and edits the whole series (host patches the source routine); "なし"
 * (onSelectNone → onDetachRepeat) turns the repeat off. For a manual item the
 * section starts at "なし" (value null) and choosing a frequency asks the host
 * to spin up a routine behind the scenes.
 */

export interface EventEditorItem {
  id: string;
  title: string;
  /** Calendar day this occurrence sits on (YYYY-MM-DD) — #469. */
  date: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  /** All-day occupies the day rather than a time span (#469). */
  isAllDay: boolean;
  completed: boolean;
  /** Derived status (#222) — shown as a tag on the completion toggle. */
  status: ScheduleStatus;
  memo: string;
  isRoutine: boolean;
}

/**
 * What one press of the save button changes (#628). Only the fields that
 * actually moved are present, and start/end always travel together — the pair
 * is one value (#553), and a host that received half of it would have to guess
 * the other half.
 */
export interface EventEditorPatch {
  title?: string;
  date?: string;
  isAllDay?: boolean;
  startTime?: string;
  endTime?: string;
  memo?: string;
}

export interface EventEditorLabels {
  complete: string;
  /** Already-translated status-tag labels (#222). */
  statusLabels: Record<ScheduleStatus, string>;
  title: string;
  /** Caption for the date picker (#469). */
  date: string;
  /** Caption for the all-day switch (#469). */
  allDay: string;
  startTime: string;
  endTime: string;
  memo: string;
  memoPlaceholder?: string;
  /** Primary action — "保存" (#628). */
  save: string;
  /** Shown beside the button while nothing is pending — "保存済み" (#628). */
  saved: string;
  /** Shown beside the button while a draft is pending — "未保存" (#628). */
  unsaved: string;
  /**
   * Shown on a routine occurrence: says that title / time edits ask which part
   * of the series to apply to, while the day and the all-day switch only ever
   * touch this one occurrence (#469 小粒 — the 「系列全体に適用」 hint). Omit to
   * render no hint.
   */
  seriesHint?: string;
  /** Origin chip copy for a routine-generated item. */
  originRoutine: string;
  /** Origin chip copy for a manual (single) event. */
  originEvent: string;
  /** "この日はスキップ" (routine only). */
  skipThisDay: string;
  /** "削除" — manual: plain delete / routine: opens the scope dialog (#279). */
  delete: string;
}

export interface EventEditorPaneProps {
  item: EventEditorItem;
  /** Extra origin detail appended to the routine chip (e.g. "月・水・金"). */
  originDetail?: string;
  /**
   * Commit the pending draft (#628). Fires only from the save button (or Enter
   * in a single-line field), only when something changed, and exactly ONCE per
   * press carrying every changed field — a routine occurrence's scope dialog
   * (#279) must not be asked twice for one gesture (#553).
   */
  onSave: (id: string, patch: EventEditorPatch) => void;
  /**
   * Report whether an unsaved draft is pending. The host owns the close
   * affordances (Esc, backdrop, close button, sheet dismissal) and is the only
   * place that can ask "discard?" before one of them throws the draft away.
   * Fires with `false` on unmount so a host holding this in a ref cannot be
   * left believing a torn-down editor is still dirty.
   */
  onDirtyChange?: (dirty: boolean) => void;
  /**
   * Allow moving the occurrence to another day (#469). False/omitted renders
   * the date read-only. Unlike the times this never propagates to a series —
   * the routine template has no concrete date — so the host applies it to this
   * row alone.
   */
  canEditDate?: boolean;
  /**
   * Show the all-day switch (#469). Turning it OFF has to hand the row usable
   * times back (an all-day row may carry none at all); the draft fills them in
   * from the shared `timedSpanForAllDayOff` helper, so the saved patch always
   * carries a renderable span.
   */
  canEditAllDay?: boolean;
  /** Formats the duration suffix on the end options (#553). */
  formatDuration?: (minutes: number) => string;
  onToggleComplete: (id: string) => void;
  /** Skip this occurrence (routine-generated items only). */
  onDismiss?: (id: string) => void;
  /**
   * Delete. Manual items: plain single-item delete. Routine items (#279):
   * the host MUST route this into the this/future/all scope dialog — a
   * plain single-row delete would be revived by the generator (Issue 017).
   */
  onDelete?: (id: string) => void;
  labels: EventEditorLabels;
  /**
   * Repeat section (#185 Step 3). Present the section only when the host
   * wires it (labels + weekday labels + onChangeRepeat); otherwise the pane
   * falls back to the read-only origin chip. `repeat` is the routine's
   * frequency for a routine occurrence, or null for a manual item ("なし").
   */
  repeat?: FrequencyEditorValue | null;
  repeatWeekdayLabels?: string[];
  repeatLabels?: FrequencyEditorLabels;
  /** An Event→Repeats conversion is in flight — lock the section (#434). */
  repeatPending?: boolean;
  /**
   * Frequency patch — host applies it to the source routine (or creates one
   * for a manual item). Called by the SAVE BUTTON only (#712), carrying every
   * repeat field the user changed in one patch; while the pane is open the
   * edits live in its draft.
   *
   * `fields` is the SAME press's field patch (empty when only the repeat
   * moved). It travels with the frequency because turning a repeat on spins a
   * routine up out of this occurrence: a host reading the times off the live
   * item would template the series on the values the user just replaced, and
   * every generated day would carry them (#870). The pane cannot send the
   * fields first instead — they are what raises the this/future/all dialog
   * (#279), which must stay last and be asked once.
   */
  onChangeRepeat?: (
    patch: Partial<FrequencyEditorValue>,
    fields: EventEditorPatch,
  ) => void;
  /** "なし" selected — host turns the repeat off (detach the series). Also
   *  deferred to the save button (#712). */
  onDetachRepeat?: () => void;
  /**
   * Tag affordance for this row (#468). Injected rather than built here: the
   * tag layer talks to WikiTagsUnifiedContext, and this pane is pure
   * presentation (§3.1 / §6.4). Omit to render no tag row.
   *
   * It is what makes the calendar lens usable — a calendar is a saved view
   * over one life tag, so without a way to put the tag ON an event there is
   * nothing for the lens to find.
   */
  tagSlot?: ReactNode;
  className?: string;
}

/** Every field the save button commits, held locally until it is pressed. */
interface EventEditorDraft {
  title: string;
  date: string;
  isAllDay: boolean;
  startTime: string;
  endTime: string;
  memo: string;
}

/**
 * The fields the user has actually touched. Everything absent here keeps
 * following the item.
 *
 * A draft seeded once and then left alone would turn every EXTERNAL change into
 * a fake pending edit: Realtime (or the same account on a phone) rewrites the
 * row, the pane goes on showing the values from when it opened, the button
 * lights up claiming they are unsaved — and pressing it pushes the stale values
 * back over the remote ones. Overlaying only what was typed keeps untouched
 * fields live, so a remote change lands in front of the user instead of being
 * quietly reverted by them.
 */
type EventEditorEdits = Partial<EventEditorDraft>;

function draftFromItem(item: EventEditorItem): EventEditorDraft {
  return {
    title: item.title,
    date: item.date,
    isAllDay: item.isAllDay,
    startTime: item.startTime,
    endTime: item.endTime,
    memo: item.memo,
  };
}

/**
 * What the save button would write — and, by being empty, whether there is
 * anything to write at all. Dirty state and the payload come from this ONE
 * function on purpose: derive them separately and the button eventually lights
 * up for a change it then declines to send (#434 S-1 — no control that is
 * pressable and does nothing).
 */
function buildPatch(
  item: EventEditorItem,
  draft: EventEditorDraft,
): EventEditorPatch {
  const patch: EventEditorPatch = {};
  if (draft.title !== item.title) patch.title = draft.title;
  // A cleared date input reports "" — never save that as a day. Mid-typing it
  // is a normal state (the field empties itself while a segment is rewritten),
  // so the pane also puts the stored day back on blur rather than leaving the
  // screen and the state disagreeing.
  if (draft.date && draft.date !== item.date) patch.date = draft.date;
  if (draft.isAllDay !== item.isAllDay) patch.isAllDay = draft.isAllDay;
  // One complete pair (#553): the TimeRangeField may move both ends at once,
  // so either side moving sends both.
  if (draft.startTime !== item.startTime || draft.endTime !== item.endTime) {
    patch.startTime = draft.startTime;
    patch.endTime = draft.endTime;
  }
  if (draft.memo !== item.memo) patch.memo = draft.memo;
  return patch;
}

/**
 * The pending repeat edit (#712). Three states, not a value plus a flag,
 * because "no repeat" is itself something the user can choose:
 *
 *   undefined — untouched: the section keeps following the live series, so a
 *               change made elsewhere still lands in front of the user (same
 *               reason the field draft overlays rather than snapshots)
 *   null      — "なし" picked: saving detaches the series
 *   patch     — the repeat fields the user changed, overlaid on the live one
 */
type RepeatEdits = Partial<FrequencyEditorValue> | null | undefined;

/**
 * What the section starts from on a manual item that has no series yet. Only
 * the type is ever shown from it — picking one immediately seeds the
 * type-specific fields (see `editRepeat`).
 */
const BLANK_REPEAT: FrequencyEditorValue = {
  frequencyType: "daily",
  frequencyDays: [],
  frequencyInterval: null,
  frequencyStartDate: null,
};

/**
 * Is the drafted repeat the same one the item already has? This is what keeps
 * the save button honest about the repeat: picking "なし" on an item that has
 * no repeat, or re-picking the type it already had, must not light it up.
 *
 * `frequencyDays` compares in order — the editor keeps it sorted, so two equal
 * sets never disagree here.
 */
function sameRepeat(
  a: FrequencyEditorValue | null,
  b: FrequencyEditorValue | null,
): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.frequencyType === b.frequencyType &&
    (a.frequencyInterval ?? null) === (b.frequencyInterval ?? null) &&
    (a.frequencyStartDate ?? null) === (b.frequencyStartDate ?? null) &&
    a.frequencyDays.length === b.frequencyDays.length &&
    a.frequencyDays.every((d, i) => d === b.frequencyDays[i])
  );
}

const SAVE_BTN = cn(
  "rounded-lumen-md bg-lumen-accent px-4 py-2 text-sm font-medium text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover",
  FOCUS_RING_ON_ACCENT,
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-lumen-accent",
);

/** Inner fields, keyed by item.id from the pane so a selection change drops
 *  the pending edits cleanly. (The all-day flip used to be part of that key;
 *  since #628 it is a draft field of its own, and remounting on it would throw
 *  the rest of the pending edits away.) */
function EventEditorFields({
  item,
  originDetail,
  onSave,
  onDirtyChange,
  canEditDate,
  canEditAllDay,
  formatDuration,
  onToggleComplete,
  onDismiss,
  onDelete,
  labels,
  repeat,
  repeatWeekdayLabels,
  repeatLabels,
  repeatPending,
  onChangeRepeat,
  onDetachRepeat,
  tagSlot,
}: Omit<EventEditorPaneProps, "className">) {
  const [edits, setEdits] = useState<EventEditorEdits>({});
  // Live item underneath, the user's own edits on top (see EventEditorEdits).
  const draft: EventEditorDraft = { ...draftFromItem(item), ...edits };
  const patch = buildPatch(item, draft);
  const fieldsDirty = Object.keys(patch).length > 0;

  // The repeat draft (#712), overlaid on the live series the same way.
  const [repeatEdits, setRepeatEdits] = useState<RepeatEdits>(undefined);
  const liveRepeat = repeat ?? null;
  const repeatDraft: FrequencyEditorValue | null =
    repeatEdits === undefined
      ? liveRepeat
      : repeatEdits === null
        ? null
        : { ...(liveRepeat ?? BLANK_REPEAT), ...repeatEdits };
  const repeatDirty =
    repeatEdits !== undefined && !sameRepeat(repeatDraft, liveRepeat);
  const dirty = fieldsDirty || repeatDirty;

  // Tell the host about the pending draft so its close affordances can confirm
  // first. The ref keeps the unmount report from pinning a stale callback (and
  // from forcing every host to memoise the prop); refreshing it in an effect
  // rather than during render is what `react-hooks/refs` asks for — a render
  // React throws away must not leave a write behind.
  const onDirtyChangeRef = useRef(onDirtyChange);
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  });
  useEffect(() => {
    onDirtyChangeRef.current?.(dirty);
  }, [dirty]);
  // Unmount clears the flag: the draft dies with the component, so a host that
  // parked `dirty` in a ref must not go on guarding a pane that no longer
  // exists (the next open would confirm before it had anything to discard).
  useEffect(() => () => onDirtyChangeRef.current?.(false), []);

  // The repeat section renders only when the host fully wires it (labels +
  // weekday labels + change handler). Existing hosts/tests that omit it keep
  // the legacy read-only origin chip.
  const showRepeat =
    !!onChangeRepeat && !!repeatLabels && !!repeatWeekdayLabels;

  /*
   * Seed the type-specific fields at the moment the TYPE changes, and only
   * then (#712). The segmented control emits `{ frequencyType }` alone, so
   * "weekdays" with no day and "interval" with no interval both read as "fires
   * never" — the same hole `seedFrequencyPatch` was written for on the host
   * side, now filled one step earlier so the section SHOWS what saving would
   * write. Re-seeding on every derive instead would make the last weekday
   * impossible to clear, and clearing it is the user's own choice to make.
   */
  const editRepeat = (patch: Partial<FrequencyEditorValue>) =>
    setRepeatEdits((prev) => {
      const base = prev ?? {};
      const seeded = seedFrequencyPatch(
        patch,
        { ...(liveRepeat ?? BLANK_REPEAT), ...base },
        item.date,
      );
      return { ...base, ...seeded };
    });

  const repeatSection = showRepeat ? (
    <div className="flex flex-col gap-2 border-t border-lumen-border pt-3">
      <FrequencyEditor
        value={repeatDraft}
        onChange={editRepeat}
        onSelectNone={onDetachRepeat ? () => setRepeatEdits(null) : undefined}
        weekdayLabels={repeatWeekdayLabels}
        labels={repeatLabels}
        pending={repeatPending}
      />
    </div>
  ) : null;

  const save = () => {
    if (!dirty) return;
    // The repeat goes first: it edits the SERIES — a different row, through the
    // host's own in-flight guard (#407 / #434) — and sending it ahead keeps the
    // order this pane had before #712, when a frequency click wrote on the
    // spot and the save press always came after it.
    if (repeatDirty) {
      if (repeatEdits === null) onDetachRepeat?.();
      // The field patch rides along (#870). Going first means the host has not
      // seen the new times yet when it builds the routine template, so the
      // press has to hand them over rather than leave them to be read off the
      // item a moment later.
      else if (repeatEdits) onChangeRepeat?.(repeatEdits, patch);
    }
    // Last, and skipped when only the repeat moved: an empty patch would still
    // raise the this/future/all scope dialog (#279) on a routine occurrence,
    // asking about an edit that does not exist.
    if (fieldsDirty) onSave(item.id, patch);
  };

  // Enter in a single-line field saves rather than blurs. Blur no longer
  // commits anything (#628), so the old "Enter blurs to commit" would have left
  // the key doing nothing visible at all.
  const saveOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    // IME guard: the Enter that CONFIRMS a Japanese conversion is not a save.
    // `isComposing` alone misses exactly that keypress on WebKit (#737) — the
    // shared helper is what knows both halves of the answer.
    if (e.key === "Enter" && !isImeComposing(e)) {
      e.preventDefault();
      save();
    }
  };

  const edit = (patch: EventEditorEdits) =>
    setEdits((prev) => ({ ...prev, ...patch }));

  const toggleAllDay = () => {
    if (!draft.isAllDay) {
      edit({ isAllDay: true });
      return;
    }
    // Turning it OFF has to hand back a usable span: a row created as all-day
    // can carry no times at all, and a blank start leaves it unrenderable on
    // the time grid. Same shared helper the host used to call.
    const span = timedSpanForAllDayOff(draft.startTime, draft.endTime);
    edit({
      isAllDay: false,
      startTime: span.startTime,
      endTime: span.endTime,
    });
  };

  // A cleared date input reports "" — the save ignores it (there is no such
  // day), so leaving the field blank would show one thing and mean another,
  // with the button insisting everything is saved. Dropping the edit puts the
  // stored day back on screen, which is what the pane is actually holding.
  const restoreClearedDate = () => {
    if (draft.date) return;
    setEdits((prev) => {
      const next = { ...prev };
      // Dropping the key (rather than writing item.date into it) is what puts
      // the field back under the item, so a later remote change still reaches
      // it.
      delete next.date;
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Completion — the status tag (#222) doubles as the toggle. Clicking
          flips completed; the derived status paints the tag. Not part of the
          draft: it is an act, not a field (#628). */}
      <button
        type="button"
        aria-pressed={item.completed}
        aria-label={labels.complete}
        onClick={() => onToggleComplete(item.id)}
        className="flex items-center gap-2 self-start rounded-sm text-sm text-lumen-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      >
        <ScheduleStatusTag
          status={item.status}
          label={labels.statusLabels[item.status]}
        />
        <span>{labels.complete}</span>
      </button>

      {/* Title */}
      <label className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>{labels.title}</span>
        <input
          value={draft.title}
          onChange={(e) => edit({ title: e.target.value })}
          onKeyDown={saveOnEnter}
          aria-label={labels.title}
          className={FIELD}
        />
      </label>

      {/* Date + all-day (#469). Before this the day could only be changed by
          dragging the item across the grid, which is impossible for a day the
          grid is not showing. A date input steps its value once per segment
          press, which is why it was never committed on change; since #628 no
          field is, and both live in the draft until the save button. */}
      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className={FIELD_LABEL}>{labels.date}</span>
          <input
            type="date"
            value={draft.date}
            readOnly={!canEditDate}
            onChange={(e) => edit({ date: e.target.value })}
            onBlur={restoreClearedDate}
            onKeyDown={saveOnEnter}
            aria-label={labels.date}
            className={cn(FIELD, "tabular-nums")}
          />
        </label>
        {canEditAllDay && (
          <button
            type="button"
            role="switch"
            aria-checked={draft.isAllDay}
            onClick={toggleAllDay}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lumen-md border px-2.5 py-2 text-sm font-medium transition-colors",
              FOCUS_RING_TIGHT,
              draft.isAllDay
                ? "border-lumen-accent bg-lumen-accent-subtle text-lumen-accent"
                : "border-lumen-border-strong text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
            )}
          >
            {labels.allDay}
          </button>
        )}
      </div>

      {/* Start / End — an all-day occurrence has no time span to edit. Hidden
          rather than disabled: the switch that hides them keeps the focus, and
          a locked pair of inputs would leave the times looking authoritative
          while the row ignores them. The pair is the shared TimeRangeField
          (#553): typed entry + snapped lists, one combined value — now written
          into the draft instead of straight to the host. */}
      {!draft.isAllDay && (
        <TimeRangeField
          start={draft.startTime}
          end={draft.endTime}
          onChange={(next) =>
            edit({ startTime: next.start, endTime: next.end })
          }
          labels={{ start: labels.startTime, end: labels.endTime }}
          formatDuration={formatDuration}
        />
      )}

      {/* Origin chip + provenance action (Issue 017). The repeat section
          (#185) replaces the read-only routine chip when the host wires it;
          otherwise the legacy chip renders. */}
      {item.isRoutine ? (
        <>
          {/* #469 小粒: the fields above behave differently on a series, and
              until now the only way to find out was to edit one and watch a
              scope dialog appear. Say it before the edit instead. */}
          {labels.seriesHint && (
            <p className="text-xs leading-relaxed text-lumen-text-secondary">
              {labels.seriesHint}
            </p>
          )}
          {showRepeat ? (
            repeatSection
          ) : (
            <div className="flex items-start gap-1.5 rounded-lumen-md bg-lumen-chip-routine-bg px-2.5 py-2 text-xs leading-relaxed text-lumen-chip-routine-fg">
              <Repeat
                aria-hidden
                className="mt-0.5 size-3 shrink-0"
                strokeWidth={2.5}
              />
              <span>
                {labels.originRoutine}
                {originDetail ? ` — ${originDetail}` : ""}
              </span>
            </div>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              className="rounded-lumen-md border border-lumen-border-strong py-2 text-center text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
            >
              {labels.skipThisDay}
            </button>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-1.5 self-start rounded-lumen-md bg-lumen-chip-event-bg px-2.5 py-1 text-xs font-medium text-lumen-chip-event-fg">
            {labels.originEvent}
          </div>
          {repeatSection}
        </>
      )}

      {/* Tags (#468). Sits right under the origin block because that is where
          "what kind of thing is this" is already being answered — the calendar
          a row belongs to is the same kind of fact. */}
      {tagSlot}

      {/* Memo */}
      <label className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>{labels.memo}</span>
        <textarea
          value={draft.memo}
          onChange={(e) => edit({ memo: e.target.value })}
          placeholder={labels.memoPlaceholder}
          aria-label={labels.memo}
          className={cn(FIELD, "min-h-[72px] resize-y")}
        />
      </label>

      {/* Delete. Manual: plain single-item delete. Routine (#279): the host
          opens the this/future/all scope dialog instead of deleting directly
          — "this only" maps to Dismiss there, so the Issue 017 ghost-revival
          guard (a deleted occurrence would be regenerated) still holds. */}
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="flex items-center gap-1.5 self-start rounded-sm text-sm font-medium text-lumen-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
        >
          <Trash2 aria-hidden className="size-3.5" />
          {labels.delete}
        </button>
      )}

      {/* Save footer (#628) — the only commit. Disabled while there is nothing
          to write (#434 S-1: a control that is pressable and does nothing is
          worse than one that is visibly off), with the state spelled out beside
          it so "why can I not press this" has an answer on screen rather than
          only in the button's opacity. */}
      <div className="flex items-center justify-end gap-3 border-t border-lumen-border pt-3">
        <span
          aria-live="polite"
          className={cn(
            "text-xs",
            dirty ? "text-lumen-accent" : "text-lumen-text-secondary",
          )}
        >
          {dirty ? labels.unsaved : labels.saved}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={!dirty}
          className={SAVE_BTN}
        >
          {labels.save}
        </button>
      </div>
    </div>
  );
}

export function EventEditorPane({ className, ...rest }: EventEditorPaneProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-lumen-border bg-lumen-bg-secondary p-4",
        className,
      )}
    >
      {/* Keyed on the id alone: pending edits belong to the row they were typed
          against, so switching rows has to drop them via a remount. (#628
          dropped isAllDay from the key — the flip is a draft field now, and
          remounting on it would discard whatever else was pending.) */}
      <EventEditorFields key={rest.item.id} {...rest} />
    </div>
  );
}
