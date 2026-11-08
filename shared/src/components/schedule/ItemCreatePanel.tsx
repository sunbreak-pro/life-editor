import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileSearch,
  Lock,
  Plus,
  X,
} from "lucide-react";
import type { Goal } from "../../types/goal";
import { useEscapeLayer } from "../../hooks/useDialogA11y";
import { BottomSheet } from "../BottomSheet";
import {
  GoalPickerField,
  type GoalPickerLabels,
} from "../briefing/GoalPickerField";
import type { GoalLinkState } from "../briefing/goalLinkPreview";
import { cn } from "../cn";
import {
  DISABLED_FILLED_BTN,
  FIELD,
  FIELD_LABEL,
  FOCUS_RING_ON_ACCENT,
  FOCUS_RING_TIGHT,
} from "../styleTokens";
import { SegmentedControl } from "../SegmentedControl";
import { SegmentedToggle } from "../SegmentedToggle";
import { TagHeadingIcon } from "../TagHeadingIcon";
import { TimeRangeField } from "../TimeRangeField";
import { AllDayCheck } from "./AllDayCheck";
import {
  FrequencyEditor,
  type FrequencyEditorLabels,
  type FrequencyEditorValue,
} from "./FrequencyEditor";
import { isImeComposing } from "../../utils/imeGuard";
import { dayOfWeek } from "../../utils/scheduleGridLayout";

/*
 * ItemCreatePanel (#376) — the unified "add something to this day" panel behind
 * BOTH the Desktop creation overlay and the Mobile QuickCaptureSheet. It
 * supersedes <EventCreateFields> (#299), the event-only form those two frames
 * used to share.
 *
 * Two tabs, and both of them create something (#1370):
 *   - event: creates a ScheduleItem, exactly as before.
 *   - todo:  either creates a NEW TodoNode already scheduled into the target
 *            slot, or takes an EXISTING unscheduled todo and gives it that slot
 *            (Todos AC7). This is the timed sibling of the #298 "Today's Todo"
 *            tray: the tray declares "today, time TBD" (all-day staging), this
 *            panel says "this day, this time".
 *
 * Linking a note is NOT a third tab any more (#1370). It never created a note
 * of its own — it STAGES one (new or existing) to be linked to whatever the
 * panel creates — so sitting beside "event" and "todo" it read as a third
 * thing you could make, and reaching it hid the title field the submit
 * depends on. It is now a collapsible section BOTH tabs carry, below the
 * times and above the footer: "book the meeting, and have its minutes ready"
 * is still one pass, and the fields that pass depends on never leave the
 * screen. Collapsed by default — most creates attach nothing, and the note
 * picker is a list several rows tall.
 *
 * The item title and the times are shared across the event/todo tabs on purpose
 * — realising halfway through that "歯医者" is a todo rather than an event
 * should not cost the typing. The note's own title is separate state, since it
 * names a different thing.
 *
 * Pure presentation (§3.1 / §6.4): copy injected already translated, every write
 * is a callback; lumen-* tokens only (§5). Enter in a text field submits the
 * active target's plain create (IME composition respected — §frontend gotcha); a
 * blank title, or no selection in a picker, is a no-op.
 *
 * #2220: a tag field sits LEFT of the note trigger, on the same line. It
 * stages tags the way the note and goal fields stage theirs — the panel only
 * holds the choice, and the host writes it once the row exists. Picking an
 * existing todo seeds the field with the tags that todo already wears, so the
 * field reads as "these will be its tags" and a removal is as possible as an
 * addition. Switching the type, the source or the picked todo starts the
 * field over. Optional: a host that passes no `pools.tags` (Briefing) gets no
 * field and the layout it had.
 *
 * #2406 brought the panel to the Claude Design proposal: the day, the two
 * times and "all day" share one line (all day is a round check now, and a
 * todo can be all-day too), an event can be given a repeat on the spot, and
 * the footer reads Cancel / Add and edit / Add on both tabs. A todo has no
 * repeat to give — neither the type nor the table carries one — so the
 * repeat field is the event tab's alone. The new pieces are optional props:
 * a host that does not wire them gets the panel it had.
 *
 * #2396 rebuilt the note section to the same proposal. 「ノートを添付」 opens
 * a row of three buttons — 新規作成 (a title field, each confirmed title
 * staged as a chip), 既存から選ぶ (a multi-select picker beside the dialog on
 * Desktop, a sheet of its own on Mobile) and やめる — and every staged note
 * shows as a chip under 「添付したノート」 with its own ×. The submit carries
 * them all, as an array: `[]` is "attach nothing".
 *
 * #2402: a host that wires `handlers.onCreateMemoNote` makes 新規作成 act at
 * once instead: the form is saved as it stands and the host goes on to the
 * memo note, so that host never opens the title field. A host without the
 * handler keeps the staging above.
 *
 * #2406's event half of 「既存から選ぶ」: on the event tab it swaps the title,
 * the date line and the repeat for a search field and a list of existing
 * events. Picking one seeds the tag field with what that event wears, and the
 * submit hands the host the event's id — the host adds a COPY to the day the
 * panel was opened for and never touches the original. Optional like the rest:
 * a host that wires no `pools.events` and `onCopyEvent` gets no toggle.
 *
 * Both host frames (Modal / BottomSheet) unmount their children when closed, so
 * the local draft state re-seeds from the initial props on every open. When a
 * host keeps the panel open but changes the prefill (e.g. a different empty
 * slot), it should remount this with a `key` derived from the prefill.
 */

/** Which tab is showing; it is also what the submit acts on (#1370). */
export type ItemCreateType = "event" | "task";
/** Within the todo tab and the note section: make a new one, or pick one that
 *  exists. */
export type ItemCreateSource = "new" | "existing";

/** One row of a picker (an existing todo, or an existing note). */
export interface ItemCreateOption {
  /** Source TodoNode / NoteNode id. */
  id: string;
  title: string;
  /**
   * #2396: a password-protected note (`NoteNode.hasPassword`), drawn with a
   * lock in the note picker — the same rule the note list follows. It can
   * still be attached: the attachment is a link, and reads no body.
   */
  isLocked?: boolean;
}

/**
 * One note the panel will link to the item it creates. `new` still needs
 * creating (the host owns the write); `existing` is already an item id.
 * The submit carries them as an array since #2396 — `[]` means the user
 * staged nothing.
 */
export type ItemCreateNoteDraft =
  { kind: "new"; title: string } | { kind: "existing"; id: string };

/**
 * #2402: what 新規作成 acts on. `event` / `task` are saved from the form, with
 * `title` trimmed and possibly empty (the host names an untitled item).
 * `picked` is the todo chosen under 既存から選ぶ, which is not written at all:
 * the memo note is only linked to it.
 */
export type ItemCreateMemoTarget =
  | { kind: ItemCreateType; title: string; slot: ItemCreateSlot }
  | { kind: "picked"; todoId: string; title: string };

/**
 * #2396: where 「既存から選ぶ」 opens the note picker. `side` is a 20rem
 * panel beside the form (the host widens its frame while it is open — see
 * `onNotePickerOpenChange`), `sheet` a BottomSheet over the Mobile sheet,
 * and `inline` (the default, for a host that says nothing) a panel under the
 * button row, inside the form's own width.
 */
export type ItemCreateNotePickerPlacement = "side" | "sheet" | "inline";

export interface ItemCreatePanelLabels {
  /** Heading (and accessible name) of the item-type tablist, 「種類」. */
  typeLabel: string;
  typeEvent: string;
  typeTodo: string;
  /** Heading of the shared item-title input, 「タイトル」(#2566). */
  title: string;
  /**
   * Per-type placeholder for the item-title input. Not drawn since #2566 —
   * the input has its heading instead, as the prototype draws it.
   */
  eventPlaceholder: string;
  todoPlaceholder: string;
  /** Field label of the target-day input. */
  date: string;
  /** Label and accessible name of the all-day check (#940 / #2406). */
  allDay: string;
  startTime: string;
  endTime: string;
  /** Event submit pair (#354 — create, and create-then-open-the-editor). */
  addEvent: string;
  addEventAndOpen: string;
  /** Todo submit — one label per source, because the acts differ. */
  addTodo: string;
  placeTodo: string;
  /**
   * #2406: the todo tab's "and open" twins. Optional, falling back to
   * `addEventAndOpen` — the words are the same act's on the other tab.
   */
  addTodoAndOpen?: string;
  placeTodoAndOpen?: string;
  /** #2406: the footer's Cancel. Drawn only with `onCancel` beside it. */
  cancel?: string;
  /** Heading (and accessible name) of the new / existing radiogroup, 「追加方法」. */
  sourceLabel: string;
  sourceNew: string;
  sourceExisting: string;
  /** Todo picker. */
  searchTodos: string;
  /** Shown when the todo pool itself is empty (nothing left to place). */
  todoPickerEmpty: string;
  /** Shown when the todo search query matches nothing. */
  todoPickerNoMatch: string;
  /** Note attachment (#1370) — the collapsible section BOTH tabs carry. */
  /** Trigger label of that section, e.g. "Attach a note". */
  attachNote: string;
  /**
   * #2396: accessible name of the note section's button row, and the texts
   * of its 新規作成 / 既存から選ぶ / やめる buttons. Separate fields from
   * `sourceLabel` / `sourceNew` / `sourceExisting` even when the words match:
   * the row is its own named group, so on the todo tab a screen reader hears
   * which of the two "new / existing" choices it is in.
   */
  noteSourceLabel: string;
  noteSourceNew: string;
  noteSourceExisting: string;
  noteDismiss: string;
  noteTitleLabel: string;
  notePlaceholder: string;
  /** The button beside the new-note title that stages it as a chip. */
  noteNewConfirm: string;
  searchNotes: string;
  notePickerEmpty: string;
  notePickerNoMatch: string;
  /** #2396: the note picker's heading, its ×, the count and the done. */
  notePickerTitle: string;
  notePickerClose: string;
  /** "n 件を選択中" — the picker's running count. */
  notePickerCount: (count: number) => string;
  notePickerDone: string;
  /** Spoken for the lock on a password-protected note. */
  noteLocked: string;
  /** Explains that the note rides along with the event / todo being created. */
  noteLinkHint: string;
  /** Caption of the staged notes' chips, 「添付したノート」. */
  attachedNote: string;
  /** Accessible name of a chip's ×, e.g. 「『議事録』を外す」. */
  removeNote: (title: string) => string;
}

/**
 * Seed values for the panel's own draft state. One bundle rather than three
 * `initial*` props (#893): they are read ONCE, at mount, and only ever travel
 * together — a host that seeds the times but not the title is passing the same
 * "where the gesture landed" fact, just partially.
 */
export interface ItemCreatePanelInitial {
  /**
   * The day the item lands on (YYYY-MM-DD), seeding the panel's own date
   * field (#940).
   *
   * Required, and the reason `initial` itself became required: the panel used
   * to take a pre-formatted `dateLabel` it only displayed, so a host that
   * forgot it lost a caption. Now the value is what the submit carries, and a
   * host that forgot it would create items on no day at all.
   */
  date: string;
  /** Seeds the start-time field (HH:MM). Default 09:00. */
  start?: string;
  /** Seeds the end-time field (HH:MM). Default 10:00. */
  end?: string;
  /** Seeds the item-title field. Default empty. */
  title?: string;
}

/**
 * Where the new item lands — the panel's own answer, not the host's (#940).
 *
 * Bundled for the same reason the handlers were (#893): date / start / end /
 * isAllDay are one fact with four fields, and threading them positionally
 * through four callbacks is how a host ends up reading the day off its own
 * state and quietly ignoring the one the user just picked.
 */
export interface ItemCreateSlot {
  /** YYYY-MM-DD, as edited in the panel. */
  date: string;
  start: string;
  end: string;
  /**
   * The all-day check, on either tab (#2406 — it used to be the event's
   * alone, #940). A todo stores it the way the tray's "add to today" does:
   * the day at 00:00 with its own all-day flag. When true the time fields
   * are off screen and `start` / `end` are stale draft values the host must
   * ignore.
   */
  isAllDay: boolean;
  /**
   * #2406: the repeat picked for a new EVENT. Absent for "no repeat", and
   * always absent on the todo tab — a todo has no repeat to hold. The host
   * turns the saved row into a series once it exists.
   */
  repeat?: FrequencyEditorValue;
}

/**
 * #2406: what the repeat field needs to draw itself — the same copy the
 * editor's repeat section takes. Omitted, the panel offers no repeat.
 */
export interface ItemCreateRepeatField {
  /** Already-translated weekday labels indexed 0 (Sun) – 6 (Sat). */
  weekdayLabels: string[];
  /** Must carry `frequencyNone`: "no repeat" is the starting choice. */
  labels: FrequencyEditorLabels;
}

/** The two "pick an existing one" pools the panel offers. */
export interface ItemCreatePanelPools {
  /**
   * The pool the "existing todo" source picks from — the host's unscheduled,
   * incomplete leaf todos (`pickAddableTodos`, the same pool the #298 tray
   * offers). Already-scheduled todos are deliberately absent: re-timing one is
   * a drag on the grid, not a create gesture.
   */
  todos: ItemCreateOption[];
  /** The pool the "existing note" source picks from (live notes). */
  notes: ItemCreateOption[];
  /**
   * The goal field of a NEW todo (#2109, plan Step 10). Optional: a host that
   * does not pass it (or has no goals to offer) gets no goal section at all.
   */
  goals?: ItemCreateGoalPool;
  /** The tag field (#2220). Omitted, the panel draws none. */
  tags?: ItemCreateTagPool;
  /**
   * #2406: the existing events the event tab can add a copy of. Omitted (or
   * with no `onCopyEvent` beside it), the event tab offers no such source.
   */
  events?: ItemCreateEventPool;
}

/** #2406: the event tab's 「既存から選ぶ」 list. */
export interface ItemCreateEventPool {
  options: ItemCreateOption[];
  /** The tags the event shows — the seed of the tag field when it is picked. */
  tagsOf: (eventId: string) => string[];
  /** The source was chosen: the list is read from here on, not before. */
  onOpen: () => void;
  labels: {
    search: string;
    /** Shown while `options` is empty. The host says why (loading, error…). */
    empty: string;
    noMatch: string;
  };
}

/**
 * Goals a new todo can be linked to (#2109). The links can only be written
 * once the todo's row exists, which the panel never sees — so the panel just
 * reports the staged goals and the host links them from the create's
 * `onSaved` (the same ordering the staged note follows).
 */
export interface ItemCreateGoalPool {
  /** The goals on offer, in display order (goalsForTodoPicker). */
  goals: readonly Goal[];
  /** Live goals, links and todos, for the before → after preview. */
  state: GoalLinkState;
  /**
   * The goals the new todo would be linked to, re-reported on every change —
   * `[]` whenever the submit would not create a new todo (the event tab, or
   * placing an existing todo, whose goals belong to its detail panel).
   */
  onStagedChange: (goalIds: string[]) => void;
  labels: GoalPickerLabels & {
    /** Disclosure trigger, 「目標につなぐ」. */
    attach: string;
    /** Caption of the echo row once the section folds up. */
    attached: string;
  };
}

/** One tag the tag field can offer (#2220). */
export interface ItemCreateTagOption {
  id: string;
  name: string;
  /** The tag's own colour, drawn as a dot on its label. */
  color?: string | null;
  /**
   * The tag's stored icon, drawn at the head of its row in the list (#2566,
   * through TagHeadingIcon like every other tag surface — #1291). Omitted or
   * null draws the generic tag glyph.
   */
  icon?: string | null;
}

/**
 * The tag field (#2220). Optional like the goal pool: a host that does not
 * pass it gets no field. The panel stages; the host writes the staged tags
 * once the row exists (useCreatePanelTags).
 */
export interface ItemCreateTagPool {
  /** Every tag on offer, in display order. */
  tags: readonly ItemCreateTagOption[];
  /** The tags an EXISTING item already wears — the seed when one is picked. */
  tagsOf: (itemId: string) => string[];
  /**
   * The staged tag ids, re-reported on every change. For a picked todo it is
   * the whole set it should end up with, so the host can take tags off too.
   */
  onStagedChange: (tagIds: string[]) => void;
  labels: {
    /** Caption of the field, 「タグ」. */
    field: string;
    /** The button that opens the list, 「タグを追加」. */
    add: string;
    /** Accessible name of a label's ×, e.g. 「『仕事』を外す」. */
    remove: (name: string) => string;
    /** Shown in the list when there are no tags at all. */
    empty: string;
  };
}

/** Stands in for the todo the submit has not created yet. */
const NEW_TODO = { id: "\u0000new-todo", done: false, isDeleted: false };

/**
 * Every write the panel can perform. Bundled (#893) because they are ONE
 * capability, not four independent ones: a host that wires three of them ships
 * a submit button that silently does nothing on the fourth tab, and the
 * required-object shape makes that a compile error instead.
 */
export interface ItemCreatePanelHandlers {
  /**
   * Fired with the trimmed (non-empty) title, the slot, and the staged notes
   * (#2396: every one of them, `[]` for none).
   */
  onSubmitEvent: (
    title: string,
    slot: ItemCreateSlot,
    notes: readonly ItemCreateNoteDraft[],
  ) => void;
  /**
   * Same payload as `onSubmitEvent`, but the host should follow the write by
   * opening the new item's detail editor (#354).
   *
   * Two buttons rather than one policy: creating an event and filling in a
   * memo / repeat rule are different intents. Blocking on the editor every
   * time punishes the common case (blocking out several slots in a row),
   * while never opening it strands the other one — the panel only carries
   * title + times. Enter keeps the plain create, so the fast path stays fast.
   */
  onSubmitEventAndOpen: (
    title: string,
    slot: ItemCreateSlot,
    notes: readonly ItemCreateNoteDraft[],
  ) => void;
  /** Create a new todo scheduled into the chosen day + window. */
  onCreateTodo: (
    title: string,
    slot: ItemCreateSlot,
    notes: readonly ItemCreateNoteDraft[],
  ) => void;
  /** Give an EXISTING todo the target day + window. */
  onPlaceTodo: (
    todoId: string,
    slot: ItemCreateSlot,
    notes: readonly ItemCreateNoteDraft[],
  ) => void;
  /**
   * #2406: the todo tab's "and open" twins — the same writes as the two
   * above, followed by the todo's detail panel (the one #626 put in the
   * Schedule). Optional, unlike the four above: a host without them draws
   * the todo footer without the button rather than one that does nothing.
   */
  onCreateTodoAndOpen?: (
    title: string,
    slot: ItemCreateSlot,
    notes: readonly ItemCreateNoteDraft[],
  ) => void;
  onPlaceTodoAndOpen?: (
    todoId: string,
    slot: ItemCreateSlot,
    notes: readonly ItemCreateNoteDraft[],
  ) => void;
  /**
   * #2406: add a copy of an existing event to the day the panel was opened
   * for. No slot: the date and the times are off screen on this source, and
   * the copy keeps the source's time of day.
   */
  onCopyEvent?: (
    eventId: string,
    notes: readonly ItemCreateNoteDraft[],
  ) => void;
  /** The same, followed by the copy's editor. */
  onCopyEventAndOpen?: (
    eventId: string,
    notes: readonly ItemCreateNoteDraft[],
  ) => void;
  /**
   * #2402: 新規作成 saves at once and goes to a new memo note. Optional: a host
   * without it keeps 新規作成 as the title field that stages a chip. `notes`
   * are the chips staged so far, which ride along.
   */
  onCreateMemoNote?: (
    target: ItemCreateMemoTarget,
    notes: readonly ItemCreateNoteDraft[],
  ) => void;
}

export interface ItemCreatePanelProps {
  /**
   * Draft seeds. Required since #940 — see `ItemCreatePanelInitial.date`.
   *
   * The day used to arrive as a pre-formatted `dateLabel` the panel only
   * printed: where the user opened the panel WAS the day, so offering to
   * change it here would have contradicted the gesture. It turned out the
   * gesture is often only how the panel got opened — the toolbar「+」lands on
   * the anchor day, and Briefing always says today — leaving no way to book
   * next Tuesday without navigating there first. The row is now an input, and
   * the host reads the day back off the submit.
   */
  initial: ItemCreatePanelInitial;
  pools: ItemCreatePanelPools;
  handlers: ItemCreatePanelHandlers;
  /** Formats the duration suffix on the end-time options (#553). */
  formatDuration?: (minutes: number) => string;
  labels: ItemCreatePanelLabels;
  /**
   * #2406: the footer's Cancel — closes without writing anything. Drawn
   * together with `labels.cancel`; the frame's own × stays as well.
   */
  onCancel?: () => void;
  /** #2406: the event tab's repeat field. Omitted, no repeat is offered. */
  repeat?: ItemCreateRepeatField;
  /** #2396: where the note picker opens. Default `inline`. */
  notePicker?: ItemCreateNotePickerPlacement;
  /**
   * #2396: told when the note picker opens and closes (and `false` once more
   * if the panel unmounts with it open). The Desktop frame widens itself
   * while it is `true`, so the 20rem `side` panel sits beside the form
   * instead of running off a narrow screen.
   */
  onNotePickerOpenChange?: (open: boolean) => void;
}

/**
 * What the repeat field starts from once a type is picked — only the type is
 * ever shown from it. The rest stays blank until the user edits it, and
 * `repeatOnDate` fills the gaps from the date being added.
 */
const BLANK_REPEAT: FrequencyEditorValue = {
  frequencyType: "daily",
  frequencyDays: [],
  frequencyInterval: null,
  frequencyStartDate: null,
  frequencyEndDate: null,
};

/**
 * #2426: the repeat as the user edited it. A day or start date seeded when the
 * rhythm was picked used to be stored here too, and then outlived a change of
 * date — the event landed on a weekday its series did not fire on, or before
 * its start. So only hand edits are stored, and what is shown and sent is
 * worked out from them on every render (a keyboard-typed date reports each
 * intermediate value, so applying a change to the state would leave a trail).
 */
interface RepeatDraft {
  rhythm: FrequencyEditorValue;
  /** The date the weekday chips were last pressed on. Null: never pressed. */
  daysPickedOn: string | null;
}

/**
 * The weekdays for the date being added. Untouched chips (or chips pressed back
 * to the one weekday a seed would draw) follow the date. Hand-picked ones are
 * never taken away: a date moved since gets its weekday added to them, so the
 * event stays in its own series. A set emptied by hand stays empty, which is
 * the user's own "fires never" (see `seedFrequencyPatch`).
 */
function weekdaysOnDate(
  picked: number[],
  pickedOn: string | null,
  date: string,
): number[] {
  const weekday = dayOfWeek(date);
  if (
    pickedOn === null ||
    (picked.length === 1 && picked[0] === dayOfWeek(pickedOn))
  ) {
    return [weekday];
  }
  if (pickedOn === date || picked.length === 0 || picked.includes(weekday)) {
    return picked;
  }
  return [...picked, weekday].sort((a, b) => a - b);
}

/**
 * The repeat to show and send for the date being added, the same self-consistent
 * shape `seedFrequencyPatch` gives the editor's section. Only the fields the
 * rhythm reads are filled: the host honours a start date on ANY rhythm, so one
 * left over from "every N days" would begin a daily series on a stale day. A
 * start date typed by hand stays as typed, wherever the date goes.
 */
function repeatOnDate(
  { rhythm, daysPickedOn }: RepeatDraft,
  date: string,
): FrequencyEditorValue {
  const filled: FrequencyEditorValue = {
    ...rhythm,
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
  };
  if (rhythm.frequencyType === "weekdays") {
    filled.frequencyDays = weekdaysOnDate(
      rhythm.frequencyDays,
      daysPickedOn,
      date,
    );
  }
  if (rhythm.frequencyType === "interval") {
    filled.frequencyInterval = rhythm.frequencyInterval ?? 1;
    filled.frequencyStartDate = rhythm.frequencyStartDate ?? date;
  }
  return filled;
}

// `disabled:` states matter more here than on a normal form: the note tab hides
// the field the submit depends on, so a dead-but-lit button would give the user
// nothing to look at when a click does nothing.
//
// The two buttons no longer share one spelling (#1803). The filled submit
// sinks into the shared recess, because fading an accent fill keeps the hue
// that says "press me". The outline button beside it keeps the opacity: it has
// no fill to mislead anyone with, and greying it would invent a box.
const DISABLED_OUTLINE_BTN = "disabled:cursor-not-allowed disabled:opacity-50";
//
// #2406: `max-md:min-h-11` gives all three footer buttons the 44px floor on a
// phone (rules/frontend.md §Gotchas); Desktop keeps the `py-2` height.
// #2427: `max-md:basis-auto` shares out only the room left after the labels. An
// equal split gives each 103px at 375px, and 「追加して詳細へ」 needs 110px.
const PRIMARY_BTN = `flex-1 rounded-lumen-md bg-lumen-accent py-2 text-center text-sm font-medium text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover max-md:min-h-11 max-md:basis-auto ${FOCUS_RING_ON_ACCENT} ${DISABLED_FILLED_BTN}`;
const SECONDARY_BTN = `flex-1 rounded-lumen-md border border-lumen-border-strong py-2 text-center text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11 max-md:basis-auto ${DISABLED_OUTLINE_BTN}`;
// Cancel writes nothing, so it takes neither the fill nor the outline — only
// its own width, at the far end from the submit.
const CANCEL_BTN = `shrink-0 rounded-lumen-md px-3 py-2 text-center text-sm font-medium text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text max-md:min-h-11 ${FOCUS_RING_TIGHT}`;
const HINT = "py-3 text-center text-xs text-lumen-text-secondary";

/**
 * Search field + list, shared by the todo and note pickers. Capped height
 * with its own scroll: a pool is the whole backlog, and letting it grow would
 * push the times and the submit button out of a Mobile sheet.
 *
 * Single-select by default (the todo picker: the picked todo IS what the
 * submit acts on). #2396: `multi` turns it into the note picker's list — a
 * check box on every row, `aria-multiselectable`, and a lock on a
 * password-protected note.
 */
function PickerList({
  options,
  query,
  onQueryChange,
  isPicked,
  onPick,
  searchLabel,
  emptyLabel,
  noMatchLabel,
  multi,
}: {
  options: ItemCreateOption[];
  query: string;
  onQueryChange: (value: string) => void;
  isPicked: (id: string) => boolean;
  onPick: (id: string) => void;
  searchLabel: string;
  emptyLabel: string;
  noMatchLabel: string;
  multi?: {
    /** The listbox's name. */
    label: string;
    /** Spoken for the lock on a locked row. */
    lockedLabel: string;
    /** Focus the search field on mount (the picker just opened). */
    focusSearch?: boolean;
    /** The list's height cap, which differs by where the picker sits. */
    listClassName?: string;
  };
}) {
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.title.toLowerCase().includes(q));
  }, [options, query]);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const focusSearch = multi?.focusSearch ?? false;
  useEffect(() => {
    if (focusSearch) searchRef.current?.focus();
  }, [focusSearch]);

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <input
        ref={searchRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={searchLabel}
        aria-label={searchLabel}
        className={FIELD}
      />
      {options.length === 0 ? (
        <p className={HINT}>{emptyLabel}</p>
      ) : matches.length === 0 ? (
        <p className={HINT}>{noMatchLabel}</p>
      ) : (
        <ul
          role="listbox"
          aria-label={multi?.label}
          aria-multiselectable={multi ? true : undefined}
          className={cn(
            "overflow-y-auto rounded-lumen-md border border-lumen-border",
            multi?.listClassName ?? "max-h-44",
          )}
        >
          {matches.map((option) => {
            const picked = isPicked(option.id);
            return (
              // `presentation` on the <li> so the button is the listbox's
              // effective child: options of one list, not a row of toggles.
              <li key={option.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={picked}
                  onClick={() => onPick(option.id)}
                  data-locked={option.isLocked ? "" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 border-b border-lumen-border px-2.5 py-2 text-left text-sm transition-colors last:border-b-0",
                    // A row is a tap target of its own on a phone
                    // (rules/frontend.md §Gotchas).
                    "max-md:min-h-11",
                    picked && !multi
                      ? "bg-lumen-accent-subtle text-lumen-accent"
                      : "text-lumen-text hover:bg-lumen-hover",
                    FOCUS_RING_TIGHT,
                  )}
                >
                  {multi && (
                    // Square, because it picks things (#2217: round marks a
                    // state, square picks).
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                        picked
                          ? "border-lumen-accent bg-lumen-accent text-lumen-on-accent"
                          : "border-lumen-border-strong bg-lumen-bg",
                      )}
                    >
                      {picked && <Check className="size-3" />}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    {option.title}
                  </span>
                  {multi && option.isLocked && (
                    <>
                      <Lock
                        aria-hidden
                        className="size-3.5 shrink-0 text-lumen-text-secondary"
                      />
                      <span className="sr-only">{multi.lockedLabel}</span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * #2396: the note picker — search, a multi-select list, and a foot with the
 * running count and 「できた」. The choice is a draft until 「できた」: the
 * × (and Esc, and a Mobile backdrop press) closes it with the staged notes
 * as they were, so the two exits mean two different things.
 *
 * The draft is seeded at mount, and the picker mounts on each opening, so it
 * always starts from what is staged now.
 */
function NotePicker({
  placement,
  options,
  initialIds,
  labels,
  onDone,
  onClose,
}: {
  placement: ItemCreateNotePickerPlacement;
  options: ItemCreateOption[];
  initialIds: readonly string[];
  labels: ItemCreatePanelLabels;
  onDone: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<string[]>(() => [...initialIds]);
  const [query, setQuery] = useState("");
  const toggle = (id: string) =>
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  // The sheet is a dialog of its own and takes Esc through its own layer;
  // the side / inline panel borrows one, so Esc closes it and not the
  // dialog around it.
  useEscapeLayer({ open: placement !== "sheet", onEscape: onClose });

  const body = (
    <>
      <PickerList
        options={options}
        query={query}
        onQueryChange={setQuery}
        isPicked={(id) => draft.includes(id)}
        onPick={toggle}
        searchLabel={labels.searchNotes}
        emptyLabel={labels.notePickerEmpty}
        noMatchLabel={labels.notePickerNoMatch}
        multi={{
          label: labels.notePickerTitle,
          lockedLabel: labels.noteLocked,
          // The sheet focuses its first control itself (useDialogA11y).
          focusSearch: placement !== "sheet",
          listClassName: placement === "inline" ? "max-h-44" : "max-h-72",
        }}
      />
      <div className="flex items-center justify-between gap-2 border-t border-lumen-border pt-2">
        <span
          aria-live="polite"
          className="text-xs tabular-nums text-lumen-text-secondary"
        >
          {labels.notePickerCount(draft.length)}
        </span>
        <button
          type="button"
          onClick={() => onDone(draft)}
          className={cn(
            "shrink-0 rounded-lumen-md bg-lumen-accent px-3 py-1.5 text-sm font-medium text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover max-md:min-h-11",
            FOCUS_RING_ON_ACCENT,
          )}
        >
          {labels.notePickerDone}
        </button>
      </div>
    </>
  );

  if (placement === "sheet") {
    // Over the full-screen create sheet: a second BottomSheet portals after
    // the first, so it sits on top, and its backdrop press reaches only its
    // own `onClose` (the first checks that the press landed on itself).
    return (
      <BottomSheet
        open
        onClose={onClose}
        title={labels.notePickerTitle}
        closeLabel={labels.notePickerClose}
      >
        <div className="flex flex-col gap-3" data-note-picker="sheet">
          {body}
        </div>
      </BottomSheet>
    );
  }

  return (
    <section
      aria-label={labels.notePickerTitle}
      data-note-picker={placement}
      className={cn(
        "flex flex-col gap-3 rounded-lumen-md border border-lumen-border bg-lumen-bg p-3",
        // 20rem beside the form, as in the proposal. The frame makes room.
        placement === "side" && "w-80 shrink-0",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-lumen-text">
          {labels.notePickerTitle}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={labels.notePickerClose}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text max-md:size-11",
            FOCUS_RING_TIGHT,
          )}
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
      {body}
    </section>
  );
}

/** The three buttons of the note row (#2396), sized as one family. */
const NOTE_ROW_BTN = `inline-flex items-center gap-1.5 rounded-lumen-md border border-lumen-border px-2.5 py-1 text-xs text-lumen-text transition-colors hover:bg-lumen-hover max-md:min-h-11 ${FOCUS_RING_TIGHT}`;

/** One staged note, keyed for its chip. */
interface StagedNote {
  key: string;
  draft: ItemCreateNoteDraft;
}

/** A staged note as its chip draws it. */
interface NoteChip extends StagedNote {
  title: string;
  locked: boolean;
}

/**
 * The tag field (#2220): the staged tags as labels, each with an ×, and a
 * 「タグを追加」 button that opens the tag list. A press in the list toggles
 * the tag, and the list stays open so several can be picked in one go.
 */
function TagField({
  pool,
  selected,
  onChange,
}: {
  pool: ItemCreateTagPool;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const byId = useMemo(
    () => new Map(pool.tags.map((t) => [t.id, t])),
    [pool.tags],
  );

  // Outside-press closes the list, like the TagPicker on the edit panels.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );

  return (
    <div
      ref={containerRef}
      data-create-tag-field=""
      className="relative flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open && !isImeComposing(e)) {
          // The list closes, not the panel's frame around it.
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <span className={FIELD_LABEL}>{pool.labels.field}</span>
      {selected.map((id) => {
        const tag = byId.get(id);
        if (!tag) return null;
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary py-0.5 pl-2 pr-0.5 text-xs text-lumen-text"
          >
            {tag.color && (
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
            )}
            {tag.name}
            <button
              type="button"
              aria-label={pool.labels.remove(tag.name)}
              onClick={() => toggle(id)}
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text max-md:size-11",
                FOCUS_RING_TIGHT,
              )}
            >
              <X aria-hidden className="size-3" />
            </button>
          </span>
        );
      })}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={cn(
          "inline-flex items-center gap-1 rounded-lumen-md px-1.5 py-0.5 text-xs text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text max-md:min-h-11",
          FOCUS_RING_TIGHT,
        )}
      >
        <Plus aria-hidden className="size-3.5 shrink-0" />
        {pool.labels.add}
      </button>
      {open && (
        <div
          id={listId}
          // #2566: above the button. The field sits near the dialog's foot,
          // so a list opening downward covered「キャンセル」and「追加」.
          className="absolute bottom-full left-0 z-20 mb-1 w-52 rounded-lumen-md border border-lumen-border bg-lumen-bg py-1 shadow-lumen-lg"
        >
          {pool.tags.length === 0 ? (
            <p className={HINT}>{pool.labels.empty}</p>
          ) : (
            <ul
              role="listbox"
              aria-multiselectable="true"
              aria-label={pool.labels.add}
              className="max-h-48 overflow-y-auto"
            >
              {pool.tags.map((tag) => {
                const on = selected.includes(tag.id);
                return (
                  <li key={tag.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => toggle(tag.id)}
                      className={cn(
                        "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm text-lumen-text transition-colors hover:bg-lumen-hover",
                        FOCUS_RING_TIGHT,
                      )}
                    >
                      <TagHeadingIcon
                        icon={tag.icon ?? null}
                        color={tag.color ?? null}
                        size={14}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {tag.name}
                      </span>
                      {on && (
                        <Check
                          aria-hidden
                          className="size-3.5 shrink-0 text-lumen-accent"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Resolve the TODO selection THROUGH the current query, so narrowing past the
 * picked row drops it from both the highlight and the submit — the picked todo
 * IS what the submit acts on, and acting on something the user can no longer
 * see would be a silent surprise.
 *
 * The note picker deliberately does NOT go through this (see `noteChips`): a
 * staged note is carried across tabs and shown back as a chip, so it stays
 * visible after the query moves on.
 */
function resolvePicked(
  options: ItemCreateOption[],
  query: string,
  pickedId: string | null,
): ItemCreateOption | null {
  if (!pickedId) return null;
  const q = query.trim().toLowerCase();
  const found = options.find((o) => o.id === pickedId);
  if (!found) return null;
  return !q || found.title.toLowerCase().includes(q) ? found : null;
}

export function ItemCreatePanel({
  initial,
  pools,
  handlers,
  formatDuration,
  labels,
  onCancel,
  repeat: repeatField,
  notePicker = "inline",
  onNotePickerOpenChange,
}: ItemCreatePanelProps) {
  // Unpacked back into the flat names the body has always used, so the bundles
  // (#893) stay a wire-format change and nothing below has to know about them.
  const {
    date: initialDate,
    start: initialStart = "09:00",
    end: initialEnd = "10:00",
    title: initialTitle = "",
  } = initial;
  const {
    todos: existingTodos,
    notes: existingNotes,
    goals: goalPool,
    tags: tagPool,
    events: eventPool,
  } = pools;
  const {
    onSubmitEvent,
    onSubmitEventAndOpen,
    onCreateTodo,
    onPlaceTodo,
    onCreateTodoAndOpen,
    onPlaceTodoAndOpen,
    onCopyEvent,
    onCopyEventAndOpen,
    onCreateMemoNote,
  } = handlers;
  const [type, setType] = useState<ItemCreateType>("event");
  const [title, setTitle] = useState(initialTitle);
  const [date, setDate] = useState(initialDate);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [allDay, setAllDay] = useState(false);
  // #2406: the repeat draft — null is "no repeat", the field's first choice.
  const [repeatDraft, setRepeatDraft] = useState<RepeatDraft | null>(null);

  const [todoSource, setTodoSource] = useState<ItemCreateSource>("new");
  const [todoQuery, setTodoQuery] = useState("");
  const [pickedTodoId, setPickedTodoId] = useState<string | null>(null);

  // Collapsed by default (#1370) — see the header. The staged notes below are
  // independent of it, so folding the row up never drops a note.
  const [noteOpen, setNoteOpen] = useState(false);
  // #2396: the new-note title field (新規作成) and the picker (既存から選ぶ).
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  // Every staged note, in the order it was staged — the chips' order too.
  const [stagedNotes, setStagedNotes] = useState<StagedNote[]>([]);
  const newNoteKeyRef = useRef(0);
  const existingNoteButtonRef = useRef<HTMLButtonElement | null>(null);
  const noteSectionId = useId();

  const pickedTodo = resolvePicked(existingTodos, todoQuery, pickedTodoId);
  const placing = type === "task" && todoSource === "existing";

  // #2406: the event tab's own source, kept apart from the todo tab's so the
  // two tabs do not flip each other. The pick goes through the query as the
  // todo's does: the submit never acts on a row narrowed out of sight.
  const offersExistingEvents = !!eventPool && !!onCopyEvent;
  const [eventSource, setEventSource] = useState<ItemCreateSource>("new");
  const [eventQuery, setEventQuery] = useState("");
  const [pickedEventId, setPickedEventId] = useState<string | null>(null);
  const copying =
    type === "event" && offersExistingEvents && eventSource === "existing";
  const pickedEvent = copying
    ? resolvePicked(eventPool?.options ?? [], eventQuery, pickedEventId)
    : null;

  // #2109: goals for a NEW todo only. Kept across tab switches like the other
  // drafts, but reported as [] whenever the submit would not create a todo.
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalIds, setGoalIds] = useState<string[]>([]);
  const goalSectionId = useId();
  const offersGoals =
    type === "task" && !placing && !!goalPool && goalPool.goals.length > 0;
  const stagedGoalKey = offersGoals ? goalIds.join("\n") : "";
  const onStagedGoalChange = goalPool?.onStagedChange;
  useEffect(() => {
    onStagedGoalChange?.(stagedGoalKey ? stagedGoalKey.split("\n") : []);
  }, [onStagedGoalChange, stagedGoalKey]);

  /*
   * #2220: the staged tags. They start over whenever what the submit acts on
   * changes — the type, the source, or the picked todo — and a picked todo
   * seeds them with the tags it already wears. Adjusted while rendering
   * rather than from an effect (React's pattern for state derived from a
   * prop, as ScheduleEventEditor's tag scope does).
   */
  const tagSeedKey = `${type}|${todoSource}|${eventSource}|${placing ? (pickedTodo?.id ?? "") : (pickedEvent?.id ?? "")}`;
  const seedTags = () =>
    pickedEvent && eventPool
      ? eventPool.tagsOf(pickedEvent.id)
      : placing && pickedTodo && tagPool
        ? tagPool.tagsOf(pickedTodo.id)
        : [];
  const [tagIds, setTagIds] = useState<string[]>(seedTags);
  const [tagKey, setTagKey] = useState(tagSeedKey);
  if (tagKey !== tagSeedKey) {
    setTagKey(tagSeedKey);
    setTagIds(seedTags());
  }
  const stagedTagKey = tagIds.join("\n");
  const onStagedTagChange = tagPool?.onStagedChange;
  useEffect(() => {
    onStagedTagChange?.(stagedTagKey ? stagedTagKey.split("\n") : []);
  }, [onStagedTagChange, stagedTagKey]);

  /*
   * #2396: what rides along with the create — every staged note. An existing
   * one is resolved by id against the live pool (not through the picker's
   * query: a staged note shows as a chip whatever the search said), and one
   * the pool no longer holds is dropped rather than linked blind.
   */
  const notesById = useMemo(
    () => new Map(existingNotes.map((o) => [o.id, o])),
    [existingNotes],
  );
  const noteChips = stagedNotes.flatMap((s): NoteChip[] => {
    if (s.draft.kind === "new")
      return [
        { key: s.key, title: s.draft.title, locked: false, draft: s.draft },
      ];
    const option = notesById.get(s.draft.id);
    return option
      ? [
          {
            key: s.key,
            title: option.title,
            locked: option.isLocked === true,
            draft: s.draft,
          },
        ]
      : [];
  });
  // A title typed in the open field but not yet confirmed still rides along,
  // as the single draft did — the submit must not lose what is on screen. A
  // blank one stages nothing: opening the field and changing your mind must
  // not create an untitled note.
  const pendingNoteTitle = noteOpen && newNoteOpen ? noteTitle.trim() : "";
  const stagedDrafts: ItemCreateNoteDraft[] = [
    ...noteChips.map((c) => c.draft),
    ...(pendingNoteTitle
      ? [{ kind: "new" as const, title: pendingNoteTitle }]
      : []),
  ];
  const stagedExistingIds = noteChips.flatMap((c) =>
    c.draft.kind === "existing" ? [c.draft.id] : [],
  );

  const stageNewNote = () => {
    const trimmed = noteTitle.trim();
    if (!trimmed) return;
    newNoteKeyRef.current += 1;
    const key = `new-${newNoteKeyRef.current}`;
    setStagedNotes((prev) => [
      ...prev,
      { key, draft: { kind: "new", title: trimmed } },
    ]);
    // The field stays open for the next one.
    setNoteTitle("");
  };
  const unstageNote = (key: string) =>
    setStagedNotes((prev) => prev.filter((s) => s.key !== key));
  // 「できた」: the picked set becomes the staged existing notes — kept ones
  // keep their place, new ones join at the end.
  const commitPicked = (ids: readonly string[]) => {
    setStagedNotes((prev) => {
      const kept = prev.filter(
        (s) => s.draft.kind === "new" || ids.includes(s.draft.id),
      );
      const have = new Set(
        kept.flatMap((s) => (s.draft.kind === "existing" ? [s.draft.id] : [])),
      );
      return [
        ...kept,
        ...ids
          .filter((id) => !have.has(id))
          .map((id) => ({ key: id, draft: { kind: "existing" as const, id } })),
      ];
    });
  };
  const closePicker = () => {
    setPickerOpen(false);
    // Back to the button that opened it — the side panel leaves the page
    // with the focus inside it. (The sheet restores its own opener too.)
    existingNoteButtonRef.current?.focus();
  };
  // The note row's toggle. Folding it up confirms a typed title, so what was
  // on screen becomes a chip rather than vanishing with the field.
  const toggleNoteRow = () => {
    if (noteOpen) {
      if (newNoteOpen) stageNewNote();
      setNewNoteOpen(false);
      setPickerOpen(false);
    }
    setNoteOpen((v) => !v);
  };
  // 「やめる」: the row, the field and the picker close, and an unconfirmed
  // title is dropped. The chips stay — each has its own ×.
  const dismissNoteRow = () => {
    setNoteOpen(false);
    setNewNoteOpen(false);
    setNoteTitle("");
    setPickerOpen(false);
  };

  // #2396: tell the frame while the picker is open (so the Desktop overlay
  // can widen for the side panel), and that it closed when the panel goes.
  useEffect(() => {
    if (!pickerOpen || !onNotePickerOpenChange) return;
    onNotePickerOpenChange(true);
    return () => onNotePickerOpenChange(false);
  }, [pickerOpen, onNotePickerOpenChange]);

  // #2406: all-day is on both tabs now. #940 kept it to the event, on the
  // reading that a todo had no way to show it — but the tray's "add to today"
  // has written all-day todos all along (todoAddCandidateWrite), and the
  // calendar draws them in the all-day lane. One draft, like the times.
  const isAllDay = allDay;
  // The repeat, by contrast, is the event's alone: a todo has no repeat to
  // hold. Kept as a draft across a tab switch, but never sent with a todo.
  // A cleared date input reports "" until blur restores the opening day.
  const repeatDate = date || initialDate;
  const repeatValue = repeatDraft && repeatOnDate(repeatDraft, repeatDate);
  const repeat = type === "event" && repeatField ? repeatValue : null;
  const slot: ItemCreateSlot = repeat
    ? { date, start, end, isAllDay, repeat }
    : { date, start, end, isAllDay };
  const editRepeat = (patch: Partial<FrequencyEditorValue>) =>
    setRepeatDraft((prev) => ({
      rhythm: { ...(prev?.rhythm ?? BLANK_REPEAT), ...patch },
      daysPickedOn: patch.frequencyDays
        ? repeatDate
        : (prev?.daysPickedOn ?? null),
    }));

  const submitTitled = (
    handler: (
      t: string,
      s: ItemCreateSlot,
      n: readonly ItemCreateNoteDraft[],
    ) => void,
  ) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    handler(trimmed, slot, stagedDrafts);
  };
  const submitPrimary = () => {
    if (copying) {
      if (pickedEvent) onCopyEvent?.(pickedEvent.id, stagedDrafts);
      return;
    }
    if (placing) {
      if (!pickedTodo) return;
      onPlaceTodo(pickedTodo.id, slot, stagedDrafts);
      return;
    }
    submitTitled(type === "event" ? onSubmitEvent : onCreateTodo);
  };
  const copyAndOpen = onCopyEventAndOpen
    ? () => {
        if (pickedEvent) onCopyEventAndOpen(pickedEvent.id, stagedDrafts);
      }
    : null;
  // #2406: the "and open" twin of whatever the primary does. Null when the
  // host wired no twin for this tab, and then the footer draws no button.
  const submitAndOpen: (() => void) | null =
    type === "event"
      ? copying
        ? copyAndOpen
        : () => submitTitled(onSubmitEventAndOpen)
      : placing
        ? onPlaceTodoAndOpen
          ? () => {
              if (!pickedTodo) return;
              onPlaceTodoAndOpen(pickedTodo.id, slot, stagedDrafts);
            }
          : null
        : onCreateTodoAndOpen
          ? () => submitTitled(onCreateTodoAndOpen)
          : null;
  const andOpenLabel =
    type === "event"
      ? labels.addEventAndOpen
      : placing
        ? (labels.placeTodoAndOpen ?? labels.addEventAndOpen)
        : (labels.addTodoAndOpen ?? labels.addEventAndOpen);
  const primaryLabel =
    type === "event"
      ? labels.addEvent
      : placing
        ? labels.placeTodo
        : labels.addTodo;
  // What the footer needs before it can act.
  const canSubmit = copying
    ? !!pickedEvent
    : placing
      ? !!pickedTodo
      : !!title.trim();
  // #2402: unlike the footer, 新規作成 takes an empty title (the host names the
  // item) — only placing needs its todo picked first.
  const createMemoNote = () => {
    if (!onCreateMemoNote) return;
    if (!placing) {
      onCreateMemoNote({ kind: type, title: title.trim(), slot }, stagedDrafts);
    } else if (pickedTodo) {
      onCreateMemoNote(
        { kind: "picked", todoId: pickedTodo.id, title: pickedTodo.title },
        stagedDrafts,
      );
    }
  };
  // Copying an existing event (#2406) keeps the staging row: its submit is the
  // host's copy, and a memo note made at once would write a blank new event.
  const memoNoteAtOnce = !!onCreateMemoNote && !copying;

  const picker = pickerOpen ? (
    <NotePicker
      placement={notePicker}
      options={existingNotes}
      initialIds={stagedExistingIds}
      labels={labels}
      onDone={(ids) => {
        commitPicked(ids);
        closePicker();
      }}
      onClose={closePicker}
    />
  ) : null;

  // #2396: an outer row, always drawn, so the side picker can join the form
  // without remounting it (a remount would drop the time field's own draft).
  // Without the side picker the form is its only child and fills it.
  return (
    <div className="flex items-start gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* #2566: each switch under its own heading, the two side by side
            (the prototype's add dialog). They were two full-width tracks
            stacked with the names in aria-label only. A phone stacks them
            again below `sm`: half of a 390px sheet cannot hold
            「新規作成 / 既存から選ぶ」without crushing the labels. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span aria-hidden className={FIELD_LABEL}>
              {labels.typeLabel}
            </span>
            <SegmentedControl
              options={[
                { id: "event", label: labels.typeEvent },
                { id: "task", label: labels.typeTodo },
              ]}
              value={type}
              onChange={(id) => setType(id as ItemCreateType)}
              label={labels.typeLabel}
            />
          </div>
          {(type === "task" || offersExistingEvents) && (
            <div className="flex min-w-0 flex-col gap-1.5">
              <span aria-hidden className={FIELD_LABEL}>
                {labels.sourceLabel}
              </span>
              {type === "task" ? (
                <SegmentedToggle
                  options={[
                    { value: "new" as const, label: labels.sourceNew },
                    { value: "existing" as const, label: labels.sourceExisting },
                  ]}
                  value={todoSource}
                  onChange={setTodoSource}
                  label={labels.sourceLabel}
                />
              ) : (
                <SegmentedToggle
                  options={[
                    { value: "new" as const, label: labels.sourceNew },
                    { value: "existing" as const, label: labels.sourceExisting },
                  ]}
                  value={eventSource}
                  onChange={(source) => {
                    setEventSource(source);
                    if (source === "existing") eventPool?.onOpen();
                  }}
                  label={labels.sourceLabel}
                />
              )}
            </div>
          )}
        </div>
        {copying && eventPool ? (
          <PickerList
            options={eventPool.options}
            query={eventQuery}
            onQueryChange={setEventQuery}
            isPicked={(id) => pickedEvent?.id === id}
            onPick={setPickedEventId}
            searchLabel={eventPool.labels.search}
            emptyLabel={eventPool.labels.empty}
            noMatchLabel={eventPool.labels.noMatch}
          />
        ) : placing ? (
          <PickerList
            options={existingTodos}
            query={todoQuery}
            onQueryChange={setTodoQuery}
            isPicked={(id) => pickedTodo?.id === id}
            onPick={setPickedTodoId}
            searchLabel={labels.searchTodos}
            emptyLabel={labels.todoPickerEmpty}
            noMatchLabel={labels.todoPickerNoMatch}
          />
        ) : (
          // #2566: a heading over the input, and no placeholder — the
          // prototype's form, where every field is named above itself.
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className={FIELD_LABEL}>{labels.title}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isImeComposing(e)) submitPrimary();
              }}
              className={FIELD}
            />
          </label>
        )}
        {/* Date, start, end and all-day on one line (#2406, the Claude Design
            proposal; #940 had the times on a row of their own). The date input
            keeps its own draft — changing it here books the item elsewhere
            without moving the calendar the panel was opened from. Clearing it
            back to blank restores the day the panel opened on, since a create
            with no date is not a thing the user can mean.
            On a narrow sheet the line wraps instead of overflowing: the bases
            below are where a field gives its seat up to the next line (8rem +
            11rem + the check + two gaps fit the 512px Modal's body, so Desktop
            keeps one line; a phone puts the times on a second one), and
            `min-w-0` on every column (#1036) is what keeps a column that stays
            from flooring at the input's intrinsic width.
            #2406: hidden, not unmounted, while copying an existing event, so a
            half-typed time survives a trip to that source and back. */}
        <div hidden={copying} className="flex flex-wrap items-end gap-3">
          {/* `appearance-none` + `min-w-0` on the input and the wider `gap-3`
              are #1403's half of the same fix (see EventEditorPane). */}
          <label className="flex min-w-0 flex-1 basis-32 flex-col gap-1.5">
            <span className={FIELD_LABEL}>{labels.date}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onBlur={() => {
                if (!date) setDate(initialDate);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isImeComposing(e)) submitPrimary();
              }}
              aria-label={labels.date}
              className={cn(FIELD, "min-w-0 appearance-none tabular-nums")}
            />
          </label>
          {/* #553: the shared TimeRangeField replaces the native time pair —
              typed entry + snapped lists, and the range invariant lives there.
              Hidden rather than disabled while all-day is on, matching
              EventEditorPane: the check that hides them keeps the focus, and a
              locked pair would leave the times looking authoritative while
              nothing reads them. */}
          {!isAllDay && (
            <TimeRangeField
              start={start}
              end={end}
              onChange={(next) => {
                setStart(next.start);
                setEnd(next.end);
              }}
              labels={{ start: labels.startTime, end: labels.endTime }}
              formatDuration={formatDuration}
              className="min-w-0 flex-[2] basis-44"
            />
          )}
          <AllDayCheck
            checked={allDay}
            onToggle={() => setAllDay((v) => !v)}
            label={labels.allDay}
          />
        </div>
        {/* #2406: the repeat, for a new event only (see the header). "No
            repeat" comes first and is where the field starts. */}
        {type === "event" && !copying && repeatField && (
          <FrequencyEditor
            value={repeatValue}
            onChange={editRepeat}
            onSelectNone={() => setRepeatDraft(null)}
            weekdayLabels={repeatField.weekdayLabels}
            labels={repeatField.labels}
          />
        )}
        {/* Goals (#2109) — the same disclosure as the note below it, collapsed
            by default for the same reason: most todos serve no goal. */}
        {offersGoals && goalPool && (
          <div className="flex flex-col gap-2 border-t border-lumen-border pt-2">
            <button
              type="button"
              onClick={() => setGoalOpen((v) => !v)}
              aria-expanded={goalOpen}
              aria-controls={goalSectionId}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-lumen-md px-1 py-1 text-left text-xs text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text max-md:min-h-11",
                FOCUS_RING_TIGHT,
              )}
            >
              {goalOpen ? (
                <ChevronDown aria-hidden className="size-3.5 shrink-0" />
              ) : (
                <ChevronRight aria-hidden className="size-3.5 shrink-0" />
              )}
              <span className="truncate">{goalPool.labels.attach}</span>
            </button>
            {goalOpen ? (
              <div id={goalSectionId}>
                <GoalPickerField
                  goals={goalPool.goals}
                  snapshot={goalPool.state}
                  todo={NEW_TODO}
                  baselineIds={[]}
                  selectedIds={goalIds}
                  onChange={setGoalIds}
                  labels={goalPool.labels}
                />
              </div>
            ) : (
              goalIds.length > 0 && (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary px-2.5 py-1.5 text-sm text-lumen-text">
                  <span className={FIELD_LABEL}>{goalPool.labels.attached}</span>
                  {goalPool.goals
                    .filter((g) => goalIds.includes(g.id))
                    .map((g) => (
                      <span key={g.id}>{g.title}</span>
                    ))}
                </p>
              )
            )}
          </div>
        )}
        {/* Note attachment (#1370) — was a third tab; see the header. Placed
            last because it is the optional extra: the fields the submit needs
            stay at the top whether or not this is open. */}
        <div className="flex flex-col gap-2 border-t border-lumen-border pt-2">
          {/* #2220: tags on the left, the note trigger on the right, one line. */}
          <div className="flex items-start gap-2">
            {/* #2406: on the existing-event source the tags are the picked
                event's, so there is no field until one is picked. */}
            {tagPool && (!copying || pickedEvent) && (
              <TagField pool={tagPool} selected={tagIds} onChange={setTagIds} />
            )}
            <button
              type="button"
              onClick={toggleNoteRow}
              aria-expanded={noteOpen}
              aria-controls={noteSectionId}
              className={cn(
                "flex items-center gap-1.5 rounded-lumen-md px-1 py-1 text-left text-xs text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text max-md:min-h-11",
                // Alone on its line it spans it, as before; beside the tags it
                // keeps to its own width at the right end.
                tagPool ? "ml-auto shrink-0" : "w-full",
                FOCUS_RING_TIGHT,
              )}
            >
              {noteOpen ? (
                <ChevronDown aria-hidden className="size-3.5 shrink-0" />
              ) : (
                <ChevronRight aria-hidden className="size-3.5 shrink-0" />
              )}
              <span className="truncate">{labels.attachNote}</span>
            </button>
          </div>
          {/* #2396: the row of three — 新規作成 / 既存から選ぶ / やめる. The
              trigger above opens and folds it. */}
          {noteOpen && (
            <div id={noteSectionId} className="flex flex-col gap-2">
              <div
                role="group"
                aria-label={labels.noteSourceLabel}
                className="flex flex-wrap items-center gap-2"
              >
                <button
                  type="button"
                  onClick={
                    memoNoteAtOnce
                      ? createMemoNote
                      : () => setNewNoteOpen((v) => !v)
                  }
                  // #2402: with the handler it acts at once and opens nothing.
                  aria-expanded={memoNoteAtOnce ? undefined : newNoteOpen}
                  disabled={memoNoteAtOnce && placing && !pickedTodo}
                  className={cn(
                    NOTE_ROW_BTN,
                    DISABLED_OUTLINE_BTN,
                    newNoteOpen && "border-lumen-accent text-lumen-accent",
                  )}
                >
                  <FilePlus aria-hidden className="size-3.5 shrink-0" />
                  {labels.noteSourceNew}
                </button>
                <button
                  ref={existingNoteButtonRef}
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  aria-expanded={pickerOpen}
                  aria-haspopup={notePicker === "sheet" ? "dialog" : undefined}
                  className={cn(
                    NOTE_ROW_BTN,
                    pickerOpen && "border-lumen-accent text-lumen-accent",
                  )}
                >
                  <FileSearch aria-hidden className="size-3.5 shrink-0" />
                  {labels.noteSourceExisting}
                </button>
                <button
                  type="button"
                  onClick={dismissNoteRow}
                  className={cn(
                    "inline-flex items-center rounded-lumen-md px-2.5 py-1 text-xs text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text max-md:min-h-11",
                    FOCUS_RING_TIGHT,
                  )}
                >
                  {labels.noteDismiss}
                </button>
              </div>
              {newNoteOpen && (
                <div className="flex items-center gap-2">
                  <input
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    onKeyDown={(e) => {
                      // #2396: Enter stages this title as a chip — it no longer
                      // submits the panel, since several can be staged in a row.
                      // Never the Enter that confirms an IME conversion.
                      if (e.key === "Enter" && !isImeComposing(e)) {
                        e.preventDefault();
                        stageNewNote();
                      }
                    }}
                    placeholder={labels.notePlaceholder}
                    aria-label={labels.noteTitleLabel}
                    className={cn(FIELD, "min-w-0 flex-1")}
                  />
                  <button
                    type="button"
                    onClick={stageNewNote}
                    disabled={!noteTitle.trim()}
                    className={cn(
                      "shrink-0 rounded-lumen-md border border-lumen-border-strong px-3 py-1.5 text-sm text-lumen-text transition-colors hover:bg-lumen-hover max-md:min-h-11",
                      FOCUS_RING_TIGHT,
                      DISABLED_OUTLINE_BTN,
                    )}
                  >
                    {labels.noteNewConfirm}
                  </button>
                </div>
              )}
              {notePicker !== "side" && picker}
              {/* The note is an attachment, not a target — say so, or the submit
                  button below ("Add event") reads like a mistake. */}
              <p className="text-xs text-lumen-text-secondary">
                {labels.noteLinkHint}
              </p>
            </div>
          )}
          {/* #2396: every staged note as a chip, whether the row is open or
              not — the chips are where a note is taken off again. */}
          {noteChips.length > 0 && (
            <div
              data-attached-notes=""
              className="flex flex-wrap items-center gap-1.5"
            >
              <span className={cn("shrink-0", FIELD_LABEL)}>
                {labels.attachedNote}
              </span>
              {noteChips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary py-0.5 pl-2 pr-0.5 text-xs text-lumen-text"
                >
                  {chip.locked && (
                    <Lock
                      aria-hidden
                      className="size-3 shrink-0 text-lumen-text-secondary"
                    />
                  )}
                  <span className="min-w-0 truncate">{chip.title}</span>
                  <button
                    type="button"
                    aria-label={labels.removeNote(chip.title)}
                    onClick={() => unstageNote(chip.key)}
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text max-md:size-11",
                      FOCUS_RING_TIGHT,
                    )}
                  >
                    <X aria-hidden className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        {/* The footer acts on the active tab; opening the note section leaves it
            alone. #2406: Cancel / Add and edit / Add, in the proposal's order,
            on both tabs — the submit at the end the eye finishes on. */}
        <div className="flex items-center gap-2">
          {onCancel && labels.cancel && (
            <button type="button" onClick={onCancel} className={CANCEL_BTN}>
              {labels.cancel}
            </button>
          )}
          {submitAndOpen && (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={submitAndOpen}
              className={SECONDARY_BTN}
            >
              {andOpenLabel}
            </button>
          )}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={submitPrimary}
            className={PRIMARY_BTN}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
      {notePicker === "side" && picker}
    </div>
  );
}
