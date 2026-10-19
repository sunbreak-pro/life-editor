import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CheckSquare,
  Plus,
  Sparkles,
  Sun,
  Sunrise,
  Target,
} from "lucide-react";
import type { TodoNode, TodoStatus } from "../../types/todoTree";
import type { TimerSession } from "../../types/timer";
import { tagFaceStyle } from "../../utils/scheduleTagColor";
import { SkeletonList } from "../SkeletonList";
import { TAP_TARGET_TALL } from "../styleTokens";
import { TagHeadingIcon } from "../TagHeadingIcon";
import { TodoStatusCheckbox } from "../TodoStatusCheckbox";
import type { ExtractedBriefing } from "./extractBriefing";
import { BRIEFING_HINT_CLASS } from "./briefingStyles";

/*
 * BriefingView — the morning-paper home surface (Briefing plan Step 1).
 *
 * Pure presentation (§6.4): no DataService, no useTranslation — the host
 * (web/src/briefing/BriefingScreen.tsx) fetches + aggregates and injects
 * everything through props. Layout language is "紙面, not dashboard":
 * a single centered reading column, generous rules (borders), serif display
 * type for the masthead/focus line, and the Briefing accent duo (#269):
 * 朱 lumen-briefing-shu for "today / action" marks, 琥珀 lumen-briefing-kohaku
 * for context / annotations. All colors are lumen-* tokens (no hardcodes).
 *
 * The visual zone —「きのうまでの自分」, the three adopted Analytics widgets —
 * used to be one of these sections. It lives in the shared detail panel now
 * (#938 → BriefingVizPanel.tsx): everything the paper prints is about today,
 * and three backward-looking charts in the middle of it kept breaking that
 * thread while pushing 持ち越し below the fold. The host still computes the
 * data from the same BriefingData it passes here.
 *
 * 持ち越し followed it into the panel in #2285 (BriefingSidePanels.tsx): a
 * past day's todo showing through is something to look up, not part of the
 * day the paper prints.
 */

/**
 * One WikiTag on a row of「今日のスケジュール」(#2223) — what the row prints
 * under its title. `color` and `icon` are the tag's own (user data), both
 * nullable the way the tag row stores them.
 */
export interface BriefingTag {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

/** One row of「今日のスケジュール」— today's schedule, host-shaped. */
export interface BriefingScheduleEntry {
  id: string;
  title: string;
  /** "HH:MM" (empty for all-day). */
  startTime: string;
  /**
   * "HH:MM" (#2223) — with `startTime`, what tells the table whether the
   * event is over, under way, or still ahead. Optional so a fixture without
   * it reads as a moment rather than a span: over once its start has passed.
   */
  endTime?: string;
  /**
   * The routine it was generated from (#2223). The tags of an occurrence that
   * carries none of its own are the routine's — the same fallback Schedule's
   * colour takes (scheduleViewModels.ts `eventTagColor`).
   */
  routineId?: string | null;
  /** The row's tags (#2223). Undefined / empty = no tag line. */
  tags?: BriefingTag[];
  /**
   * The display colour of an all-day chip (#2223) — the colour Schedule's
   * month view paints the same chip with. Null = the plain event face.
   */
  tagColor?: string | null;
  /**
   * Data only since #1373 — nothing on the paper draws it. An event has no
   * completion in the UI any more, but the `completed` column and the MCP
   * `set_schedule_complete` tool both stay, and 夕刊's「今後の予定」still
   * drops a row that tool has closed.
   */
  completed: boolean;
  /** True when the item was generated from a Routine (shows the tag). */
  isRoutine: boolean;
  isAllDay: boolean;
}

/**
 * One todo row of「今日のスケジュール」— host-shaped, purposes resolved to
 * titles. Since #939 these ride inside the schedule block rather than under a
 * heading of their own.
 */
export interface BriefingTodoEntry {
  id: string;
  title: string;
  status: TodoStatus;
  /**
   * "HH:MM" when the todo carries a clock, "" when it does not — all-day or
   * merely placed on the day (#1369). The host reads it off the same
   * `todoScheduleSlot` the calendar chips do, so the paper and the grid can
   * never disagree about when a todo is.
   */
  startTime: string;
  /** Titles of linked goal/notes (WikiTagsUnified item↔item links). */
  purposes: string[];
  /**
   * Titles of the goals this todo is linked to (#2106) — goal rows, not the
   * note links `purposes` carries. Optional so a host without the goals read
   * (and every fixture written before it) simply draws no mark.
   */
  goals?: string[];
  /** The todo's tags (#2223). Undefined / empty = no tag line. */
  tags?: BriefingTag[];
}

/** One row of「持ち越し」. */
export interface BriefingCarryoverEntry {
  id: string;
  title: string;
  /** Host-formatted "N日目" label (i18n interpolation stays host-side). */
  daysLabel: string;
  /** True once completed today — kept on the board with a strikethrough. */
  completed: boolean;
}

export interface BriefingData {
  /** Host-formatted date line, e.g. "2026年7月13日 月曜日". */
  dateLine: string;
  /** Extracted briefing (null → "no briefing yet" empty state). */
  briefing: ExtractedBriefing | null;
  schedule: BriefingScheduleEntry[];
  todos: BriefingTodoEntry[];
  /**
   * Not read by this view since #2285 — it feeds <BriefingCarryoverPanel> in
   * the detail panel, which the same host mounts from this same aggregate.
   */
  carryover: BriefingCarryoverEntry[];
  /**
   * Timer sessions. Not read by this view since #938 — they feed
   * <BriefingVizPanel> in the detail panel, which the same host mounts from
   * this same aggregate.
   */
  sessions: TimerSession[];
  /** Full todo tree — same deal: <BriefingVizPanel>'s completion trend. */
  todoNodes: TodoNode[];
}

export interface BriefingLabels {
  masthead: string;
  /**
   * Kicker of the top line —「ゆうべの自分から」since #2106 (it was「今日の
   * フォーカス」). Same note, same writer; only the words changed.
   */
  focusLabel: string;
  aiTitle: string;
  aiSource: string;
  /** Empty state of that line — nothing was written last evening (#2106). */
  noFocus: string;
  /** Screen-reader lead of a todo row's goal marks —「目標:」(#2106). */
  goalMark: string;
  /**
   * Heading of the merged「今日のスケジュール」block (#939) — todos and
   * schedule rows share it now, so it is also the heading a day with todos
   * but no events reads under.
   */
  scheduleTitle: string;
  /** Empty state of the block — shown only when neither column has a row. */
  noSchedule: string;
  routineTag: string;
  /** The all-day band's label —「終日」. */
  allDay: string;
  /**
   * The time table (#2223). The three column headings, the last row's time
   * label for todos with no clock, the mark on an event under way, and the
   * screen-reader name of the current-time line.
   */
  timeColumn: string;
  eventsColumn: string;
  todosColumn: string;
  untimed: string;
  ongoing: string;
  nowLine: string;
  /** Group name of the column switch in the block heading. */
  columnSwitch: string;
  /** Accessible name + tooltip of each column heading's「+」. */
  addEvent: string;
  addTodo: string;
  /**
   * 「他 N 件」— the month view's own wording (scheduleScreen.moreCount), for
   * the all-day band and a row's tag line alike.
   */
  moreCount: (count: number) => string;
  /** Folds the opened all-day band back to two chips. */
  close: string;
  /**
   * The carryover block's copy. The block is drawn by <BriefingCarryoverPanel>
   * since #2285; the words stay here so the host resolves the paper's copy as
   * one object and hands the panel the same one.
   */
  carryoverTitle: string;
  /**
   * Copy for the carryover rows' checkbox (#1368) — `todoStatus` names what
   * the control sets, the two `status*` members name each value. The same
   * words 夕刊 and the Todos section use (todoDetail.*), injected rather than
   * re-worded, because the paper draws the same control they do now.
   */
  todoStatus: string;
  statusNotStarted: string;
  statusDone: string;
  /**
   * Label of a carryover row's jump action —「編集」/ "Edit" (#410). It LEADS
   * the button's accessible name, and `jumpToTodos` follows it there and in
   * the hover tooltip, so the name says WHERE the jump lands without
   * contradicting the printed text (WCAG 2.5.3 Label in Name).
   *
   * Printed beside the icon from the rows' `@md` up; below it the button is
   * icon-only and this word survives in the name alone (#1514).
   *
   * The schedule table carries no row actions since #2223: a row's title
   * opens its editor in place, and deleting is the editor's.
   */
  edit: string;
  jumpToTodos: string;
}

/** Which column of the schedule table a row, a「+」or a switch is about. */
export type BriefingColumn = "event" | "task";

export interface BriefingViewProps {
  loading: boolean;
  data: BriefingData;
  labels: BriefingLabels;
  /**
   *「ゆうべの自分から」(#1048, renamed in #2106) — written the previous
   * evening on the 夕刊 paper (or by Claude through `write_briefing`) into the
   * reserved focus note (focusSections.ts), NOT read from the daily. Null =
   * nothing was written; the line shows its empty state.
   */
  focusText: string | null;
  /**
   * The period-end review and the goals block (#2106), built by the host —
   * the same shape as EveningView's `editorSlot`, because both need the
   * DataService and this view must not. Null / undefined draws nothing, so a
   * host without the goals read leaves no empty frame behind.
   *
   * The 宣言 field and the free-text 週 / 月 / 年 goal fields that used to
   * sit here are gone from the morning paper (#2106); their stored text is
   * untouched.
   */
  goalsSlot?: ReactNode;
  /** Completes / un-completes a todo or carryover row (host → DataService). */
  onToggleTodo: (id: string) => void;
  /**
   * Opens ONE item's editor (#2223) — a table row's title or an all-day chip.
   * Where it opens is the host's: Briefing hands it to the in-place panel
   * (#2218), so the reader stays on the paper.
   */
  onOpenItem: (id: string, role: BriefingColumn) => void;
  /**
   * A column heading's「+」(#2223): opens the host's creation panel for that
   * column on THIS paper's day. The view holds no creation UI of its own.
   */
  onAddItem: (column: BriefingColumn) => void;
  /**
   * Minutes since 00:00 of the paper's day (#2223) — past 1440 after midnight
   * on a day that starts late. Drives the current-time line and the events'
   * over / under way look. Undefined = neither is drawn.
   */
  nowMinutes?: number;
  /**
   * Phone layout (#2223): the table shows ONE column at a time, switched from
   * the heading. Off = both columns, each of which the heading can hide.
   */
  narrow?: boolean;
}

/**
 * Section heading row — 段標 (朱 bar) + small-caps kicker over a hairline.
 *
 * Exported for the goals block (#2106), which the host builds and hands in as
 * `goalsSlot` — it is a block of this paper and wears the same heading. Not
 * on the barrel: it is the paper's own part, not a shared component.
 *
 * `action` is an optional control pinned to the heading's right edge (#623 —
 * the schedule section's「+」). It shares that edge with `hint`, which is
 * annotation rather than a control, so the two never collide: no section
 * carries both.
 */
export function BlockHead({
  title,
  hint,
  action,
}: {
  title: string;
  /* A node, not a string, since #1210: every other section passes plain text,
     but the AI comment's hint is an attribution badge with an icon in it. */
  hint?: ReactNode;
  action?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h3 className="flex items-center gap-2.5 text-xs font-bold tracking-[0.25em] text-lumen-text-secondary">
        <span
          aria-hidden="true"
          className="inline-block h-3.5 w-[7px] bg-lumen-briefing-shu"
        />
        {title}
      </h3>
      {hint !== undefined && (
        <span className={BRIEFING_HINT_CLASS}>{hint}</span>
      )}
      {action}
    </div>
  );
}

/**
 * 「+」on a heading (#623) — opens the host's creation panel. Since #2223 it
 * sits on each COLUMN heading of the schedule table; the block heading has
 * none. The measurements below were taken on the block heading and hold for
 * the column headings, which sit on the same hairline.
 *
 * Icon-only, unlike the row actions, because a heading has no column of
 * sibling buttons to be mistaken for a label of: the accessible name carries
 * the whole meaning and `title` shows it on hover. The padding puts the box at
 * 26×26 with the icon at 14px, and `-my-1` spends the VERTICAL half of that
 * growth on the heading's own whitespace so the rule below it does not move.
 *
 * The horizontal half (`-mr-1.5`) is gone since #1514: these sections carry no
 * side padding, so a row's right edge IS the block's, and a negative margin
 * there hung the box 6px outside its own container. The icon sits 6px in now,
 * exactly where `RowActions` puts the row actions below it — the straight
 * column down the right edge was the only thing that margin bought.
 *
 * The 44px floor (#1559) is bought in two different ways on purpose, because
 * the two directions cost different things:
 *
 *   WIDTH  — `max-md:min-w-11` grows the box. A heading is one short kicker
 *            and a control, so the 18px comes out of slack the h3 was never
 *            using, and the icon lands 22px from the right edge — the same
 *            place the row actions below now centre theirs, so the straight
 *            column the comment above describes is preserved.
 *   HEIGHT — `TAP_TARGET_TALL` instead of `min-h-11`, so the painted box stays
 *            26px tall and the rule below it still does not move. The 9px it
 *            overhangs at each end lands in the section's own `py-5` above and
 *            in `BlockHead`'s 12px `mb-3` below, clearing the first row's own
 *            target by 3px — the check that token's doc-comment asks for.
 */
function BlockHeadAddButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`-my-1 flex flex-shrink-0 items-center justify-center self-center rounded-lumen-sm p-1.5 text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-briefing-shu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-w-11 ${TAP_TARGET_TALL}`}
    >
      <Plus size={14} aria-hidden="true" />
    </button>
  );
}

/**
 * Right-edge action cluster of a row (#585 — was `EditJumpButton`'s own
 * `ml-auto` before a second action joined it).
 *
 * Only the carryover rows draw it since #2223: the schedule table's rows
 * carry no actions (the title opens the editor, deleting is the editor's), so
 * the「編集 / 削除」pair this history below talks about is gone. Exported for
 * those rows, which moved to the detail panel in #2285 (BriefingSidePanels).
 *
 * `ml-auto` pins the cluster to the row's right edge, so the buttons line up
 * in one straight column whatever the titles measure; the old icon-only jump
 * button sat immediately after the title and drifted with it, row by row.
 *
 * `-my-1` lives here rather than on each button: it cancels the vertical half
 * of the padding the buttons need for their 24×24 targets (WCAG 2.5.8), so
 * the boxes grow into the row's own whitespace instead of pushing the row
 * height around.
 *
 * There is no `-mr-1.5` twin any more (#1514). This block has no side padding,
 * so a row's right edge is the block's right edge and there was no whitespace
 * on that side to grow into — the cluster just hung 6px past its own
 * container, which is the 349px-of-content-in-a-343px-box the 390px audit
 * measured. `BlockHeadAddButton` dropped its own in the same change, so the
 *「+」above and the actions below still line up in one straight column.
 *
 * `max-md:w-full` is what puts the cluster on a LINE OF ITS OWN below `md`
 * (#1820). The 44px floor #1559 bought cost the pair 101px of a 343px row, and
 * the only thing left free to shrink was the title: a five-character event
 * title broke across two lines and an 22-character todo across three. A flex
 * item asking for the full width cannot sit beside anything, so it wraps —
 * and the row above it keeps the whole width minus the time column, which is
 * ~200px, enough for ten CJK characters even at the 18px root step. The rows
 * grow taller on a phone in exchange; that is the trade this Issue chose,
 * because a title that cannot be read is not a row at all.
 *
 * `justify-end` rather than the `ml-auto` above, which does nothing once the
 * item IS the line: the cluster still lands on the right edge, under the
 * actions of the row above, so the straight column survives the wrap.
 *
 * Both are CONTAINER variants (`@max-md:`) since the rows moved into the
 * detail panel: the 320px Desktop panel is as narrow as a phone while the
 * viewport is wide, and a viewport `max-md:` left its title a five-line
 * column. The rows' list is the `@container`; without one the cluster never
 * takes the full width.
 */
export function RowActions({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div className="-my-1 ml-auto flex flex-shrink-0 items-center gap-0.5 self-center @max-md:w-full @max-md:justify-end">
      {children}
    </div>
  );
}

/*
 * Shape of the row action (the carryover「編集」— the delete beside it left
 * with the schedule rows' actions in #2223).
 *
 * `@md:` — a container variant, not a prop — because this view is pure
 * presentation and the host hands it no width. It answers the rows' list
 * rather than the viewport since they live in the detail panel (#2285), which
 * is 320px on a wide screen too. `@md` is rem-based, so it moves with the
 * Settings font scale: the bigger the type, the wider the panel has to be
 * before the labels are offered. That is the behaviour this rule wants, since
 * what runs out is room for the words themselves (#1514).
 *
 * `gap-1` is `@md:` too: with the label hidden it would be 4px of dead space
 * between the icon and the button's right padding.
 *
 * The 44px floor stays a VIEWPORT rule: it is for a finger, and a narrow panel
 * on a Desktop is still worked with a pointer.
 *
 * `max-md:min-h-11 max-md:min-w-11` is the 44px floor (#1559), and it grows the
 * BOX rather than hanging an invisible `::after` over it the way the heading's
 * 「+」does. These two sit `gap-0.5` apart: an extension wide enough to reach
 * 44px would reach across its neighbour, so a tap meant for 編集 could answer
 * 削除 — and 削除 is the last button on the paper that may fire by accident.
 *
 * Height is free (every row that draws these is already 44px tall, held there
 * by its own checkbox or by `min-h-11`). Width was not: the pair goes from 58px
 * to 90px, and while the cluster shared a line with the title that came
 * straight off the title — 32px on top of what #1514 had just won back, which
 * is what #1820 measured as a five-character title on two lines. The width is
 * still spent, but `RowActions` now wraps below `@md`, so it is spent on a line
 * the title does not use. The words stay hidden below `@md` regardless: the
 * cluster sits under the row it belongs to, and two labelled buttons there
 * would read as a second row rather than as that row's actions.
 *
 * `min-*` and never `h-11`/`w-11`: `cn` is a plain string join, so two
 * utilities for one property are settled by Tailwind's emit order rather than
 * by call order (rules/frontend.md §Gotchas).
 */
const ROW_ACTION_BASE =
  "flex items-center justify-center whitespace-nowrap px-1.5 py-1 text-xs transition-colors max-md:min-h-11 max-md:min-w-11 @md:gap-1";

/**
 * The action's word —「編集」/「削除」— printed beside its icon on a screen wide
 * enough to hold it (#1514).
 *
 * At 390px it is not: the two labelled buttons took 128px off a 343px row, and
 * what was left squeezed a todo's title to 67px — three lines of broken word
 * for one 18-character todo. Hiding the words gives the title back ~77px and
 * gets it onto one line.
 *
 * `hidden @md:inline` rather than dropping the text from the tree: the
 * accessible name is composed from this same label (「編集: スケジュールで開く」),
 * and WCAG 2.5.3 (Label in Name) only binds while the label is VISIBLE — so a
 * narrow panel loses the printed word and keeps every name a screen reader
 * and a voice-control user hear.
 */
function RowActionLabel({ label }: { label: string }) {
  return <span className="hidden @md:inline">{label}</span>;
}

/*
 * Icon size of a row action. 16px while the word is hidden, back to the 13px
 * #410 chose once it is printed: a 13px arrow alone was the very thing that
 * issue called too small to read as an action, and below `@md` it now stands
 * alone. Set in CSS rather than through lucide's `size` prop so it can answer
 * the breakpoint at all (the prop writes width/height ATTRIBUTES, which any
 * class overrides).
 */
const ROW_ACTION_ICON = "size-4 shrink-0 @md:size-[13px]";

/**
 * Row jump action —「編集」+ ↗ (#410).
 *
 * The label is printed because a 13px arrow alone was too small to read as an
 * action — and too small to hit. Below `@md` there is no room for the word
 * next to a todo's title (#1514), so it steps back to the icon and the icon
 * grows to 16px to answer the same objection.
 *
 * The accessible name leads with that visible label and only then says where
 * the jump lands (「編集: スケジュールで開く」). Naming it `編集` alone would
 * leave six identically-named buttons on the paper, and dropping the label
 * from the name to keep the longer wording would break WCAG 2.5.3 (Label in
 * Name) — voice control users say what they see. `title` keeps the pointer
 * tooltip; it is not a substitute, since touch never shows it.
 */
export function EditJumpButton({
  onClick,
  label,
  hint,
}: {
  onClick: () => void;
  label: string;
  hint: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${hint}`}
      title={hint}
      className={`${ROW_ACTION_BASE} text-lumen-text-secondary hover:text-lumen-accent`}
    >
      <ArrowUpRight aria-hidden="true" className={ROW_ACTION_ICON} />
      <RowActionLabel label={label} />
    </button>
  );
}

/** "HH:MM" → minutes since 00:00; null for anything else. */
function toMinutes(time: string | undefined): number | null {
  if (time === undefined) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (m === null) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Where an event stands against the clock (#2223). */
type EventPhase = "past" | "ongoing" | "upcoming";

/*
 * Over once its end has passed, under way from its start up to its end. An
 * event with no usable end (none at all, or one at or before its start) runs
 * to the end of the day — the span Schedule's grid draws it with
 * (scheduleGridLayout), so the two screens agree on when it is over.
 */
function eventPhase(
  startTime: string,
  endTime: string | undefined,
  now: number,
): EventPhase {
  const start = toMinutes(startTime);
  if (start === null) return "upcoming";
  const rawEnd = toMinutes(endTime);
  const end = rawEnd !== null && rawEnd > start ? rawEnd : 24 * 60;
  if (now >= end) return "past";
  if (now >= start) return "ongoing";
  return "upcoming";
}

/** "HH:MM" of a minute count, wrapped to the 24-hour face. */
function formatMinutes(total: number): string {
  const day = ((Math.floor(total) % 1440) + 1440) % 1440;
  const h = Math.floor(day / 60);
  const m = day % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Tags printed before a row's line folds the rest into「他 N 件」. */
const TAGS_SHOWN_WHEN_FOLDED = 2;
/** A line of this many tags or more folds (#2223 — 4+ show 2 and the fold). */
const TAGS_FOLD_AT = 4;

/**
 * A row's tag line (#2223) — right-aligned under the title, each tag's icon in
 * the tag's own colour. Four or more fold to the first two and「他 N 件」in the
 * third place; the fold's tooltip names the ones it hides.
 *
 * The tooltip is `title`, a pointer affordance, so the hidden names also ride
 * in the fold's own text as screen-reader-only words: a `title` or an
 * `aria-label` on a list item is not read out everywhere.
 */
function TagLine({
  tags,
  moreCount,
}: {
  tags: BriefingTag[] | undefined;
  moreCount: (count: number) => string;
}) {
  if (tags === undefined || tags.length === 0) return null;
  const folded = tags.length >= TAGS_FOLD_AT;
  const shown = folded ? tags.slice(0, TAGS_SHOWN_WHEN_FOLDED) : tags;
  const hidden = folded ? tags.slice(TAGS_SHOWN_WHEN_FOLDED) : [];
  const hiddenNames = hidden.map((tag) => tag.name).join(" ・ ");
  return (
    <ul
      data-briefing-tags=""
      className="mt-0.5 flex flex-wrap justify-end gap-x-2 gap-y-0.5"
    >
      {shown.map((tag) => (
        <li
          key={tag.id}
          className="inline-flex min-w-0 items-center gap-0.5 text-xs text-lumen-text-secondary"
        >
          <TagHeadingIcon icon={tag.icon} color={tag.color} size={12} />
          <span className="truncate">{tag.name}</span>
        </li>
      ))}
      {folded && (
        <li
          data-briefing-tags-more=""
          title={hiddenNames}
          className="text-xs text-lumen-text-secondary"
        >
          {moreCount(hidden.length)}
          <span className="sr-only">: {hiddenNames}</span>
        </li>
      )}
    </ul>
  );
}

/** All-day chips shown before the band folds the rest away. */
const ALL_DAY_SHOWN_WHEN_FOLDED = 2;
/** A band of this many chips or more folds (#2223 — 4+ show 2 and the fold). */
const ALL_DAY_FOLD_AT = 4;

/**
 * The all-day band above the table (#2223). All-day events are not a time of
 * day, so they leave the table for a strip of their own: the sun, the word
 * 「終日」, then one chip per event in the colour Schedule's month view gives
 * the same chip (its display tag colour, else the plain event face).
 *
 * Four or more fold to two chips and「他 N 件」; pressing it shows every chip
 * and「閉じる」folds them back. No tags and no repeat glyph on a chip: the band
 * is a list of names, and its row in Schedule carries the rest.
 */
function AllDayBand({
  items,
  labels,
  onOpenItem,
}: {
  items: BriefingScheduleEntry[];
  labels: BriefingLabels;
  onOpenItem: (id: string, role: BriefingColumn) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const folds = items.length >= ALL_DAY_FOLD_AT;
  const shown =
    folds && !expanded ? items.slice(0, ALL_DAY_SHOWN_WHEN_FOLDED) : items;
  const rest = items.length - shown.length;
  // The 44px floor grows the BOX below `md` rather than hanging the
  // invisible ::after of TAP_TARGET_TALL: the chips wrap onto several lines,
  // where an extension would reach over the chip below.
  const foldButtonClass =
    "rounded-lumen-sm px-1.5 py-0.5 text-xs text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11";
  return (
    <div
      data-briefing-allday=""
      className="mb-3 flex flex-wrap items-center gap-2 rounded-lumen-md bg-lumen-bg-secondary px-3 py-2"
    >
      <span className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-bold text-lumen-text-secondary">
        <Sun size={14} aria-hidden="true" />
        {labels.allDay}
      </span>
      {shown.map((item) => {
        const face = tagFaceStyle(item.tagColor);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpenItem(item.id, "event")}
            style={face}
            className={`flex min-w-0 max-w-full items-center rounded-lumen-sm px-2 py-0.5 text-left text-xs transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11 ${
              face === undefined
                ? "bg-lumen-chip-event-bg text-lumen-chip-event-fg"
                : ""
            }`}
          >
            {/* The clip lives on the title, not the button, so the box keeps
                its full height. */}
            <span className="block truncate">{item.title}</span>
          </button>
        );
      })}
      {folds && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          className={foldButtonClass}
        >
          {labels.moreCount(rest)}
        </button>
      )}
      {folds && expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-expanded={true}
          className={foldButtonClass}
        >
          {labels.close}
        </button>
      )}
    </div>
  );
}

/**
 * The column switch in the block heading (#2223).
 *
 * Desktop: each button shows or hides its column, and the last column showing
 * cannot be hidden — its button is disabled while the other is off. Phone:
 * the table shows one column at a time and the two buttons pick which.
 * `aria-pressed` answers "is this column on screen" in both cases.
 */
function ColumnSwitch({
  narrow,
  showEvents,
  showTodos,
  onPress,
  labels,
}: {
  narrow: boolean;
  showEvents: boolean;
  showTodos: boolean;
  onPress: (column: BriefingColumn) => void;
  labels: BriefingLabels;
}) {
  const options: {
    column: BriefingColumn;
    label: string;
    shown: boolean;
    icon: ReactNode;
  }[] = [
    {
      column: "event",
      label: labels.eventsColumn,
      shown: showEvents,
      icon: <CalendarDays size={13} aria-hidden="true" />,
    },
    {
      column: "task",
      label: labels.todosColumn,
      shown: showTodos,
      icon: <CheckSquare size={13} aria-hidden="true" />,
    },
  ];
  return (
    <div
      role="group"
      aria-label={labels.columnSwitch}
      data-briefing-column-switch=""
      className="-my-1 flex flex-shrink-0 items-center gap-0.5 self-center"
    >
      {options.map((option) => {
        // Desktop only: the one column still showing has nothing to give way
        // to, so hiding it is refused rather than leaving an empty table.
        const locked = !narrow && option.shown && !(showEvents && showTodos);
        return (
          <button
            key={option.column}
            type="button"
            aria-pressed={option.shown}
            disabled={locked}
            onClick={() => onPress(option.column)}
            className={`flex items-center gap-1 rounded-lumen-sm px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent disabled:cursor-default max-md:min-h-11 ${
              option.shown
                ? "bg-lumen-bg-secondary font-semibold text-lumen-text"
                : "text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text"
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** One time row of the table: the events and the todos that start then. */
interface TableRow {
  /** "HH:MM", or "" for the last row — the items with no clock. */
  time: string;
  minutes: number | null;
  events: BriefingScheduleEntry[];
  todos: BriefingTodoEntry[];
}

/*
 * Rows in time order, then one「時間なし」row for whatever has no clock.
 * A row exists only for what the visible columns hold, so hiding a column
 * also drops the times only it had.
 */
function buildRows(
  timed: BriefingScheduleEntry[],
  todos: BriefingTodoEntry[],
  showEvents: boolean,
  showTodos: boolean,
): TableRow[] {
  const byTime = new Map<string, TableRow>();
  const rowAt = (time: string): TableRow => {
    const minutes = toMinutes(time) as number;
    const key = String(minutes);
    let row = byTime.get(key);
    if (row === undefined) {
      row = { time: formatMinutes(minutes), minutes, events: [], todos: [] };
      byTime.set(key, row);
    }
    return row;
  };
  const untimed: TableRow = { time: "", minutes: null, events: [], todos: [] };
  if (showEvents) {
    for (const item of timed) {
      if (toMinutes(item.startTime) === null) untimed.events.push(item);
      else rowAt(item.startTime).events.push(item);
    }
  }
  if (showTodos) {
    for (const todo of todos) {
      if (toMinutes(todo.startTime) === null) untimed.todos.push(todo);
      else rowAt(todo.startTime).todos.push(todo);
    }
  }
  // By minutes, not by the label: "9:05" and "09:05" are one time.
  const rows = [...byTime.values()].sort(
    (a, b) => (a.minutes ?? 0) - (b.minutes ?? 0),
  );
  if (untimed.events.length > 0 || untimed.todos.length > 0) rows.push(untimed);
  return rows;
}

/** An event in its cell: calendar glyph, title, the routine and 進行中 marks. */
function EventCell({
  item,
  phase,
  labels,
  onOpenItem,
}: {
  item: BriefingScheduleEntry;
  phase: EventPhase;
  labels: BriefingLabels;
  onOpenItem: (id: string, role: BriefingColumn) => void;
}) {
  // An event that is over steps back to the secondary ink — a colour, not an
  // opacity, so nothing behind the row shows through it.
  const ink =
    phase === "past"
      ? "text-lumen-text-secondary"
      : phase === "ongoing"
        ? "font-semibold text-lumen-briefing-shu"
        : "text-lumen-text";
  return (
    <li data-briefing-event={item.id} data-phase={phase} className="py-1">
      <div className="flex min-h-11 items-center gap-2 md:min-h-0 md:py-1">
        <CalendarDays
          size={14}
          aria-hidden="true"
          className={`flex-shrink-0 ${
            phase === "ongoing"
              ? "text-lumen-briefing-shu"
              : "text-lumen-text-secondary"
          }`}
        />
        <button
          type="button"
          onClick={() => onOpenItem(item.id, "event")}
          className={`min-w-0 flex-1 text-left text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent ${ink}`}
        >
          {item.title}
        </button>
        {item.isRoutine && (
          <span className="flex-shrink-0 rounded-full border border-lumen-briefing-kohaku bg-lumen-briefing-kohaku-subtle px-2 text-xs text-lumen-briefing-kohaku">
            {labels.routineTag}
          </span>
        )}
        {phase === "ongoing" && (
          <span className="flex-shrink-0 rounded-full border border-lumen-briefing-shu bg-lumen-briefing-shu-subtle px-2 text-xs font-semibold text-lumen-briefing-shu">
            {labels.ongoing}
          </span>
        )}
      </div>
      <TagLine tags={item.tags} moreCount={labels.moreCount} />
    </li>
  );
}

/**
 * A todo in its cell. The round mark at the head toggles it done — the same
 * control the carryover rows draw — and the title opens its editor (#2223:
 * the title used to toggle as well).
 */
function TodoCell({
  todo,
  labels,
  onToggleTodo,
  onOpenItem,
}: {
  todo: BriefingTodoEntry;
  labels: BriefingLabels;
  onToggleTodo: (id: string) => void;
  onOpenItem: (id: string, role: BriefingColumn) => void;
}) {
  return (
    <li data-briefing-todo={todo.id} className="py-0.5">
      <div className="flex items-center gap-1">
        {/* `itemName` is the row's own title (#1486): a column of checkboxes
            that only say「ステータス: 未着手」cannot be told apart. 朱 rather
            than the app accent, as on the carryover rows and 夕刊. */}
        <TodoStatusCheckbox
          status={todo.status}
          onChange={() => onToggleTodo(todo.id)}
          labels={labels}
          label={labels.todoStatus}
          itemName={todo.title}
          accentClassName="text-lumen-briefing-shu"
        />
        <button
          type="button"
          onClick={() => onOpenItem(todo.id, "task")}
          className={`min-w-0 flex-1 text-left text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent ${
            todo.status === "DONE"
              ? "text-lumen-text-secondary line-through"
              : "text-lumen-text"
          }`}
        >
          {todo.title}
        </button>
      </div>
      {/* The goals it serves (#2106), then the notes it links (◈). Hung
          under the title, past the checkbox (`min-w-11` + `gap-1`). */}
      {todo.goals !== undefined && todo.goals.length > 0 && (
        <p
          data-briefing-goals=""
          className="ml-12 flex items-center gap-1 text-xs text-lumen-text-secondary"
        >
          <Target size={12} aria-hidden="true" className="shrink-0" />
          <span className="sr-only">{labels.goalMark}</span>
          <span className="min-w-0">{todo.goals.join(" ・ ")}</span>
        </p>
      )}
      {todo.purposes.length > 0 && (
        <p
          data-briefing-purposes=""
          className="ml-12 text-xs font-semibold text-lumen-briefing-kohaku"
        >
          ◈ {todo.purposes.join(" ・ ")}
        </p>
      )}
      <TagLine tags={todo.tags} moreCount={labels.moreCount} />
    </li>
  );
}

/**
 * A column heading: its glyph, its name, and its「+」at the right edge.
 * Schedule's meaning for each glyph — a calendar for events, a check for
 * todos — so the two screens read the same way.
 */
function ColumnHead({
  icon,
  label,
  addLabel,
  onAdd,
}: {
  icon: ReactNode;
  label: string;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <th
      scope="col"
      className="border-b border-lumen-border pb-1 pl-2 text-left align-bottom font-normal"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-bold text-lumen-text-secondary">
          {icon}
          {label}
        </span>
        <BlockHeadAddButton onClick={onAdd} label={addLabel} />
      </div>
    </th>
  );
}

/**
 * 「今日のスケジュール」as a time table (#2223) — rebuilt from the one-column
 * list of #939. Rows run by time; a row holds every event and todo that
 * starts then, side by side, so the day reads as one flow. Todos with no
 * clock close the table under「時間なし」, and the all-day events sit apart in
 * the band above it.
 *
 * A real <table>: the column headings name what each cell is to assistive
 * tech, and the time column sizes itself to its widest label (`w-px` +
 * `whitespace-nowrap`), so「時間なし」never wraps.
 */
function ScheduleTable({
  data,
  labels,
  narrow,
  nowMinutes,
  onToggleTodo,
  onOpenItem,
  onAddItem,
}: {
  data: BriefingData;
  labels: BriefingLabels;
  narrow: boolean;
  nowMinutes: number | undefined;
  onToggleTodo: (id: string) => void;
  onOpenItem: (id: string, role: BriefingColumn) => void;
  onAddItem: (column: BriefingColumn) => void;
}) {
  // Desktop: which column the reader has hidden (never both). Phone: which
  // one column is on screen — events first.
  const [hiddenWide, setHiddenWide] = useState<BriefingColumn | null>(null);
  const [shownNarrow, setShownNarrow] = useState<BriefingColumn>("event");
  const showEvents = narrow ? shownNarrow === "event" : hiddenWide !== "event";
  const showTodos = narrow ? shownNarrow === "task" : hiddenWide !== "task";

  const pressColumn = (column: BriefingColumn) => {
    if (narrow) {
      setShownNarrow(column);
      return;
    }
    // Hide a showing column only while the other one is still up; bring a
    // hidden one back unconditionally.
    if (hiddenWide === column) setHiddenWide(null);
    else if (hiddenWide === null) setHiddenWide(column);
  };

  const allDay = data.schedule.filter((item) => item.isAllDay);
  const timed = data.schedule.filter((item) => !item.isAllDay);
  const rows = buildRows(timed, data.todos, showEvents, showTodos);
  const columnCount = (showEvents ? 1 : 0) + (showTodos ? 1 : 0);

  // The current-time line goes before the first row that starts after now —
  // or after the last timed row once the day's clock has passed them all.
  // No timed row, no line: there is nothing for it to stand between.
  const timedRows = rows.filter((row) => row.minutes !== null);
  let nowIndex = -1;
  if (nowMinutes !== undefined && timedRows.length > 0) {
    const after = rows.findIndex(
      (row) => row.minutes !== null && row.minutes > nowMinutes,
    );
    nowIndex = after === -1 ? timedRows.length : after;
  }

  const visibleAllDay = showEvents ? allDay : [];
  const empty = rows.length === 0 && visibleAllDay.length === 0;

  const nowRow =
    nowMinutes === undefined ? null : (
      <tr key="now" data-briefing-now-line="">
        <th
          scope="row"
          className="w-px whitespace-nowrap py-0 pr-2 text-left align-middle text-[10px] font-bold tabular-nums text-lumen-briefing-shu"
        >
          <span className="sr-only">{labels.nowLine} </span>
          {formatMinutes(nowMinutes)}
        </th>
        <td colSpan={columnCount} className="py-0 align-middle">
          <div
            aria-hidden="true"
            className="relative h-0.5 bg-lumen-briefing-shu"
          >
            <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-lumen-briefing-shu" />
          </div>
        </td>
      </tr>
    );

  return (
    <section className="border-b border-lumen-border py-5">
      <BlockHead
        title={labels.scheduleTitle}
        action={
          <ColumnSwitch
            narrow={narrow}
            showEvents={showEvents}
            showTodos={showTodos}
            onPress={pressColumn}
            labels={labels}
          />
        }
      />
      {showEvents && (
        <AllDayBand
          items={visibleAllDay}
          labels={labels}
          onOpenItem={onOpenItem}
        />
      )}
      <table data-briefing-table="" className="w-full border-collapse">
        <thead>
          <tr>
            <th
              scope="col"
              className="w-px whitespace-nowrap border-b border-lumen-border pb-1 pr-2 text-left align-bottom text-xs font-bold text-lumen-text-secondary"
            >
              {labels.timeColumn}
            </th>
            {showEvents && (
              <ColumnHead
                icon={<CalendarDays size={13} aria-hidden="true" />}
                label={labels.eventsColumn}
                addLabel={labels.addEvent}
                onAdd={() => onAddItem("event")}
              />
            )}
            {showTodos && (
              <ColumnHead
                icon={<CheckSquare size={13} aria-hidden="true" />}
                label={labels.todosColumn}
                addLabel={labels.addTodo}
                onAdd={() => onAddItem("task")}
              />
            )}
          </tr>
        </thead>
        <tbody>
          {rows.flatMap((row, index) => {
            const tr = (
              <tr
                key={row.time === "" ? "untimed" : row.time}
                data-briefing-row={row.time === "" ? "untimed" : row.time}
                className="border-b border-lumen-border last:border-b-0"
              >
                <th
                  scope="row"
                  className={`w-px whitespace-nowrap py-2 pr-2 text-left align-top text-xs font-bold tabular-nums ${
                    row.time === ""
                      ? "text-lumen-text-secondary"
                      : "text-lumen-briefing-shu"
                  }`}
                >
                  {row.time === "" ? labels.untimed : row.time}
                </th>
                {showEvents && (
                  <td className="pl-2 align-top">
                    {row.events.length > 0 && (
                      <ul>
                        {row.events.map((item) => (
                          <EventCell
                            key={item.id}
                            item={item}
                            phase={
                              nowMinutes === undefined
                                ? "upcoming"
                                : eventPhase(
                                    item.startTime,
                                    item.endTime,
                                    nowMinutes,
                                  )
                            }
                            labels={labels}
                            onOpenItem={onOpenItem}
                          />
                        ))}
                      </ul>
                    )}
                  </td>
                )}
                {showTodos && (
                  <td className="pl-2 align-top">
                    {row.todos.length > 0 && (
                      <ul>
                        {row.todos.map((todo) => (
                          <TodoCell
                            key={todo.id}
                            todo={todo}
                            labels={labels}
                            onToggleTodo={onToggleTodo}
                            onOpenItem={onOpenItem}
                          />
                        ))}
                      </ul>
                    )}
                  </td>
                )}
              </tr>
            );
            return index === nowIndex && nowRow !== null ? [nowRow, tr] : [tr];
          })}
          {nowIndex === rows.length && nowRow}
        </tbody>
      </table>
      {empty && (
        <p className="pt-3 text-sm text-lumen-text-secondary">
          {labels.noSchedule}
        </p>
      )}
    </section>
  );
}

export function BriefingView({
  loading,
  data,
  labels,
  focusText,
  goalsSlot,
  onToggleTodo,
  onOpenItem,
  onAddItem,
  nowMinutes,
  narrow = false,
}: BriefingViewProps): React.JSX.Element {
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl py-8">
        <SkeletonList rows={8} rowHeight={44} gap={12} />
      </div>
    );
  }

  const { briefing } = data;

  return (
    <div className="mx-auto w-full max-w-2xl pb-16">
      {/* The narrow 朝刊/夕刊 band used to open the paper from inside it
          (#318 / #879). It sits in the shell header now, like every other
          section's, so it stays on screen while the paper scrolls (#2223). */}

      {/* ── Masthead — the title and the focus line below deliberately keep
          the newspaper serif (#269) regardless of the Settings font; body
          copy follows the global preference (#556).

          `break-keep` because the nameplate reads 「LIFE EDITOR 朝刊」and CJK
          text may wrap between ANY two characters by default. At 390px the
          line ran out one glyph early and the paper printed 「LIFE EDITOR 夕」
          over 「刊」— a two-character word cut in half (#1513). keep-all
          removes those inter-character break points, leaving the space before
          the paper's name as the only one, so a narrow screen gets
          「LIFE EDITOR」over 「朝刊」and a wide screen is untouched. The
          English nameplate ("LIFE EDITOR BRIEFING") already broke at spaces
          only, so en sees no change. ────────────────────────────── */}
      <header className="border-b-4 border-double border-lumen-border-strong pb-4 pt-6 text-center">
        <h2 className="break-keep font-serif text-2xl font-semibold tracking-[0.3em] text-lumen-text">
          {labels.masthead}
        </h2>
        <p className="mt-2 text-xs tracking-[0.2em] text-lumen-text-secondary">
          {data.dateLine}
        </p>
      </header>

      {/* ── ゆうべの自分から — written last evening on the 夕刊 (#1048;
          renamed from「今日のフォーカス」in #2106, same note) ── */}
      <section className="border-b border-lumen-border px-2 py-6 text-center">
        <p className="mb-2 text-xs font-bold tracking-[0.3em] text-lumen-briefing-shu">
          {labels.focusLabel}
        </p>
        {focusText !== null ? (
          focusText.split("\n").map((line, i) => (
            <p
              key={i}
              className="font-serif text-xl font-semibold leading-relaxed text-lumen-text"
            >
              {line}
            </p>
          ))
        ) : (
          /* `items-start` and not `items-center` (#1826). The sentence wraps
             to three lines at 390px, and a centred icon floated beside the
             SECOND one — it read as a bullet on the middle of the sentence
             rather than as the mark in front of it. Starting the cross axis
             puts it beside the first line at every width; `mt-0.5` is the 2px
             that lines the 16px glyph up with the cap height of 20px text
             instead of with its ascender. */
          <p className="flex items-start justify-center gap-2 text-sm text-lumen-text-secondary">
            <Sunrise size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            {labels.noFocus}
          </p>
        )}
      </section>

      {/* ── AI comment (rest of the briefing section) ────────────── */}
      {briefing !== null && briefing.paragraphs.length > 0 && (
        <section className="border-b border-lumen-border py-5">
          {/*
           * Attribution badge (#1210). The wording is untouched — `aiSource`
           * has said "Claude ・ from the Briefing section" since the block
           * shipped — but it said it in the same small grey type every other
           * section's hint uses, so the one paragraph on this page that was
           * not written by the user read exactly like the ones that were. The
           * icon and the bordered pill are the whole change: the same words,
           * given a shape that separates them from an annotation.
           */}
          <BlockHead
            title={labels.aiTitle}
            hint={
              <span
                /* Colour and size come from BlockHead's own hint span, which
                   already wears BRIEFING_HINT_CLASS — this adds only shape. */
                className="inline-flex items-center gap-1 rounded-full border border-lumen-briefing-kohaku px-2 py-0.5"
              >
                <Sparkles size={11} aria-hidden="true" />
                {labels.aiSource}
              </span>
            }
          />
          <div className="rounded-lumen-md border-l-2 border-lumen-briefing-kohaku bg-lumen-briefing-kohaku-subtle px-4 py-3">
            {briefing.paragraphs.map((text, i) => (
              <p
                key={i}
                className="text-sm leading-relaxed text-lumen-text [&+&]:mt-2"
              >
                {text}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* ── Goals: the period-end review, then this week's goals
          (#2106). Host-built — see `goalsSlot`. ─────────────────── */}
      {goalsSlot}

      {/* ── Today's schedule — a time table of events and todos (#2223),
          rebuilt from the one merged list of #939. ──────────────────── */}
      <ScheduleTable
        data={data}
        labels={labels}
        narrow={narrow}
        nowMinutes={nowMinutes}
        onToggleTodo={onToggleTodo}
        onOpenItem={onOpenItem}
        onAddItem={onAddItem}
      />
    </div>
  );
}
