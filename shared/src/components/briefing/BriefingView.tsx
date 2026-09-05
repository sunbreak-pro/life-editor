import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Plus,
  Sparkles,
  Sunrise,
  Trash2,
} from "lucide-react";
import type { TodoNode, TodoStatus } from "../../types/todoTree";
import type { TimerSession } from "../../types/timer";
import { SkeletonList } from "../SkeletonList";
import { TodoStatusCheckbox } from "../TodoStatusCheckbox";
import type { ExtractedBriefing } from "./extractBriefing";
import { IntentionField } from "./IntentionField";
import { BRIEFING_HINT_CLASS } from "./briefingStyles";
import { GoalsBlock, type GoalsBlockLabels } from "./GoalsBlock";
import type { GoalPeriod } from "./goalSections";

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
 */

/** One row of「今日のスケジュール」— today's schedule, host-shaped. */
export interface BriefingScheduleEntry {
  id: string;
  title: string;
  /** "HH:MM" (empty for all-day). */
  startTime: string;
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
  focusLabel: string;
  aiTitle: string;
  aiSource: string;
  /** Empty state of the focus line — no focus was written last evening. */
  noFocus: string;
  intentionTitle: string;
  /**
   * Saved-state caption next to the intention title (host-computed).
   * Omitted while the day has no declaration at all — there is no save to
   * report yet, and「保存済み」above an empty field is a lie (#427).
   */
  intentionCaption?: string;
  intentionPlaceholder: string;
  /** Heading of the 週 / 月 / 年 goals block (#872). */
  goalsTitle: string;
  /**
   * Heading of the merged「今日のスケジュール」block (#939) — todos and
   * schedule rows share it now, so it is also the heading a day with todos
   * but no events reads under.
   */
  scheduleTitle: string;
  /** Accessible name + tooltip of the schedule section's「+」 (#623). */
  addScheduleItem: string;
  /** Empty state of the merged block — shown only when BOTH sides are empty. */
  noSchedule: string;
  routineTag: string;
  allDay: string;
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
   * Visible label of every row's jump action —「編集」/ "Edit" (#410). It IS
   * the button's accessible name now that the action is no longer icon-only;
   * `jumpToSchedule` / `jumpToTodos` moved to the hover tooltip, where the
   * longer wording still says WHERE the jump lands without contradicting the
   * visible text (WCAG 2.5.3 Label in Name).
   */
  edit: string;
  /**
   * Visible label of the row's delete action —「削除」/ "Delete" (#585). Same
   * shape as `edit` for the same reasons: it sits next to a button that reads
   * as text, so an icon-only sibling would be both unreadable at 13px and
   * below the 24×24 target the neighbour already clears.
   */
  delete: string;
  /** Tooltip + accessible-name tail for a schedule row's delete. */
  deleteScheduleHint: string;
  /** Tooltip + accessible-name tail for a todo row's delete. */
  deleteTodoHint: string;
  jumpToSchedule: string;
  jumpToTodos: string;
}

export interface BriefingViewProps {
  loading: boolean;
  data: BriefingData;
  labels: BriefingLabels;
  /**
   * Today's focus line (#1048) — written the previous evening on the 夕刊
   * paper into the reserved focus note (focusSections.ts), NOT read from the
   * daily any more. Null = no focus was written; the line shows its empty
   * state.
   */
  focusText: string | null;
  /** Today's declaration (宣言 — Step 4), newline-separated lines. */
  intentionText: string;
  /** Every keystroke — the host owns draft state + debounced persistence. */
  onIntentionChange: (text: string) => void;
  /** Blur — the host flushes a pending debounced save. */
  onIntentionBlur: () => void;
  /**
   * The CURRENT 週 / 月 / 年 goals (#872) — text per period, newline-separated.
   * They live in one reserved note (goalSections.ts), not in the daily, filed
   * under a period key: when a period turns over its field comes back empty
   * and the previous one stays in the note as history (#957). The paper only
   * ever shows the period `goalLabels` names.
   */
  goals: Record<GoalPeriod, string>;
  /** Copy of the three goal fields, period ranges included (host-formatted). */
  goalLabels: GoalsBlockLabels;
  /** Every keystroke in a goal field — same draft + debounce deal as 宣言. */
  onGoalChange: (period: GoalPeriod, text: string) => void;
  /** Blur on a goal field — the host flushes a pending debounced save. */
  onGoalBlur: () => void;
  /** Completes / un-completes a todo or carryover row (host → DataService). */
  onToggleTodo: (id: string) => void;
  /**
   * Deletes a schedule row (#585). The host decides what "delete" means for
   * the item — a manual event soft-deletes straight away, a routine-derived
   * one first asks which occurrences via Schedule's own RepeatScopeDialog.
   */
  onDeleteScheduleItem: (id: string) => void;
  /** Deletes a todo row (#585) — host → DataService soft delete. */
  onDeleteTodo: (id: string) => void;
  /**
   * Opens the host's creation panel for THIS paper's day (#623). The view
   * holds no creation UI of its own — the host mounts Schedule's shared
   * <ItemCreatePanel> and owns the write.
   */
  onAddScheduleItem: () => void;
  /** Jumps to the Schedule section (host → nav). */
  onJumpToSchedule: () => void;
  /** Jumps to the Todos section (host → nav). */
  onJumpToTodos: () => void;
  /**
   * In-body 朝刊/夕刊 switcher for the NARROW layout (#318). AppShell only
   * renders its header slot on the wide branch, so below 768px the
   * SectionHeader tab band — the only way to reach 夕刊 — disappears; the host
   * re-issues it here instead. Left undefined on the wide layout, where the
   * SectionHeader keeps owning the tabs (unchanged).
   *
   * Pass `undefined` / `null` to omit it — NOT `cond && <node>`, whose `false`
   * would clear the guard and leave an empty ruled band on the paper.
   */
  tabSwitcher?: ReactNode;
}

/**
 * Section heading row — 段標 (朱 bar) + small-caps kicker over a hairline.
 *
 * `action` is an optional control pinned to the heading's right edge (#623 —
 * the schedule section's「+」). It shares that edge with `hint`, which is
 * annotation rather than a control, so the two never collide: no section
 * carries both.
 */
function BlockHead({
  title,
  hint,
  action,
}: {
  title: string;
  /* A node, not a string, since #1210: every other section passes plain text,
     but the AI comment's hint is an attribution badge with an icon in it. */
  hint?: ReactNode;
  action?: ReactNode;
}) {
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
 * 「+」on a section heading (#623) — opens the host's creation panel.
 *
 * Icon-only, unlike the row actions, because a heading has no column of
 * sibling buttons to be mistaken for a label of: the accessible name carries
 * the whole meaning and `title` shows it on hover. The padding puts the box at
 * 26×26 with the icon at 14px, and `-my-1 -mr-1.5` spends that growth on the
 * heading's own whitespace so the rule below it does not move.
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
      className="-my-1 -mr-1.5 flex flex-shrink-0 items-center self-center rounded-lumen-sm p-1.5 text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-briefing-shu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
    >
      <Plus size={14} aria-hidden="true" />
    </button>
  );
}

/**
 * Right-edge action cluster of a row (#585 — was `EditJumpButton`'s own
 * `ml-auto` before a second action joined it).
 *
 * `ml-auto` pins the cluster to the row's right edge, so the buttons line up
 * in one straight column whatever the titles measure; the old icon-only jump
 * button sat immediately after the title and drifted with it, row by row.
 *
 * The negative margins live here rather than on each button: they cancel the
 * padding the buttons need for their 24×24 targets (WCAG 2.5.8) so the boxes
 * grow into the row's own whitespace instead of pushing the row height and
 * the right edge around. Moving them from the button to the cluster keeps the
 * jump button rendering exactly where it did with one action in the row.
 */
function RowActions({ children }: { children: ReactNode }) {
  return (
    <div className="-my-1 -mr-1.5 ml-auto flex flex-shrink-0 items-center gap-0.5 self-center">
      {children}
    </div>
  );
}

const ROW_ACTION_BASE =
  "flex items-center gap-1 whitespace-nowrap px-1.5 py-1 text-xs transition-colors";

/**
 * Row jump action —「編集」+ ↗ (#410).
 *
 * The label is visible because a 13px arrow alone was too small to read as an
 * action — and too small to hit.
 *
 * The accessible name leads with that visible label and only then says where
 * the jump lands (「編集: スケジュールで開く」). Naming it `編集` alone would
 * leave six identically-named buttons on the paper, and dropping the label
 * from the name to keep the longer wording would break WCAG 2.5.3 (Label in
 * Name) — voice control users say what they see. `title` keeps the pointer
 * tooltip; it is not a substitute, since touch never shows it.
 */
function EditJumpButton({
  onClick,
  label,
  hint,
}: {
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${hint}`}
      title={hint}
      className={`${ROW_ACTION_BASE} text-lumen-text-secondary hover:text-lumen-accent`}
    >
      <ArrowUpRight size={13} aria-hidden="true" />
      {label}
    </button>
  );
}

/**
 * Row delete action —「削除」+ 🗑 (#585). Deliberately the same shape, size and
 * naming rule as its `EditJumpButton` neighbour: two adjacent actions where
 * only one carries text would read as a label with an ornament, and the
 * destructive one is the last place to shrink the hit target. Only the hover
 * colour differs (danger, not accent) — the resting state stays quiet so the
 * paper does not turn into a row of red buttons.
 */
function DeleteRowButton({
  onClick,
  label,
  hint,
}: {
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${hint}`}
      title={hint}
      className={`${ROW_ACTION_BASE} text-lumen-text-secondary hover:text-lumen-danger`}
    >
      <Trash2 size={13} aria-hidden="true" />
      {label}
    </button>
  );
}

/*
 * The time column of 「今日のスケジュール」— one width and one type style for every row
 * in the block, event or todo (#1369). A timed todo prints its HH:MM exactly
 * where an event prints its own; anything else hands this an empty label and
 * gets a spacer, which holds the column open so every title stays on one
 * straight edge without printing a blank the reader could mistake for a
 * missing time.
 */
function TimeCell({ label }: { label: string }) {
  if (label === "") {
    return <span aria-hidden="true" className="w-14 flex-shrink-0" />;
  }
  return (
    <span className="w-14 flex-shrink-0 text-xs font-bold tabular-nums text-lumen-briefing-shu">
      {label}
    </span>
  );
}

export function BriefingView({
  loading,
  data,
  labels,
  focusText,
  intentionText,
  onIntentionChange,
  onIntentionBlur,
  goals,
  goalLabels,
  onGoalChange,
  onGoalBlur,
  onToggleTodo,
  onDeleteScheduleItem,
  onDeleteTodo,
  onAddScheduleItem,
  onJumpToSchedule,
  onJumpToTodos,
  tabSwitcher,
}: BriefingViewProps): React.JSX.Element {
  if (loading) {
    // The switcher rides along the skeleton too — a slow fetch must never
    // strand a narrow-width reader on the tab they can no longer leave.
    return (
      <div className="mx-auto w-full max-w-2xl py-8">
        {tabSwitcher != null && <div className="mb-4 px-2">{tabSwitcher}</div>}
        <SkeletonList rows={8} rowHeight={44} gap={12} />
      </div>
    );
  }

  const { briefing } = data;

  // All-day rows first, then the timed ones (#939). The host already sorts
  // this way, but the divider's position is a promise the view makes — it has
  // to sit between the todos and the FIRST all-day row — so the grouping is
  // re-stated here instead of being inherited silently. Stable partition: the
  // host's order inside each group is untouched.
  const scheduleRows = [
    ...data.schedule.filter((item) => item.isAllDay),
    ...data.schedule.filter((item) => !item.isAllDay),
  ];

  return (
    <div className="mx-auto w-full max-w-2xl pb-16">
      {/* ── 朝刊/夕刊 switcher — narrow layout only (#318) ──────────
          ABOVE the masthead (#879): the band carries the hamburger that
          opens the drawer (#609), and every other section draws that row at
          the very top of the page (PageContainer's header slot). Below the
          title it was Briefing's own header order, one screen out of step
          with the rest. On the wide layout the slot is undefined, so the
          paper still opens on its masthead — nothing moves there. */}
      {tabSwitcher != null && (
        <div className="border-b border-lumen-border px-2 py-3">
          {tabSwitcher}
        </div>
      )}

      {/* ── Masthead — the title and the focus line below deliberately keep
          the newspaper serif (#269) regardless of the Settings font; body
          copy follows the global preference (#556) ────────────────── */}
      <header className="border-b-4 border-double border-lumen-border-strong pb-4 pt-6 text-center">
        <h2 className="font-serif text-2xl font-semibold tracking-[0.3em] text-lumen-text">
          {labels.masthead}
        </h2>
        <p className="mt-2 text-xs tracking-[0.2em] text-lumen-text-secondary">
          {data.dateLine}
        </p>
      </header>

      {/* ── Focus line — written last evening on the 夕刊 (#1048) ── */}
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
          <p className="flex items-center justify-center gap-2 text-sm text-lumen-text-secondary">
            <Sunrise size={16} aria-hidden="true" />
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

      {/* ── Today's intention (宣言 — Step 4) ────────────────────── */}
      <section className="border-b border-lumen-border py-5">
        <BlockHead
          title={labels.intentionTitle}
          hint={labels.intentionCaption}
        />
        <IntentionField
          value={intentionText}
          placeholder={labels.intentionPlaceholder}
          onChange={onIntentionChange}
          onBlur={onIntentionBlur}
        />
      </section>

      {/* ── Standing goals: week → month → year (#872) ───────────── */}
      <section className="border-b border-lumen-border py-5">
        <BlockHead title={labels.goalsTitle} />
        <GoalsBlock
          values={goals}
          labels={goalLabels}
          onChange={onGoalChange}
          onBlur={onGoalBlur}
        />
      </section>

      {/* ── Today's schedule — todos ride on top of it (#939) ────────
          One list, not two sections: a todo placed on today and an all-day
          event are the same promise to the reader, and the old separate
          「今日の Todo と、その目的」heading made the page ask twice what the
          day holds. Order is todos → hairline → all-day → timed, so the rows
          run from "no clock at all" down to "at 09:00". */}
      <section className="border-b border-lumen-border py-5">
        <BlockHead
          title={labels.scheduleTitle}
          action={
            <BlockHeadAddButton
              onClick={onAddScheduleItem}
              label={labels.addScheduleItem}
            />
          }
        />
        {data.todos.length === 0 && data.schedule.length === 0 ? (
          <p className="text-sm text-lumen-text-secondary">
            {labels.noSchedule}
          </p>
        ) : (
          <ul className="space-y-1">
            {data.todos.map((todo) => (
              <li key={todo.id}>
                {/* One height for every row in this list (#1442). The shared
                    checkbox carries the 44px touch floor, so a row holding one
                    is 44px tall — and the schedule rows below claim the same
                    minimum rather than letting the list step down at the point
                    where the todos end. */}
                <div className="flex min-h-11 items-center gap-3">
                  {/* Same column, same format as the timed rows below — a
                      todo placed at 09:00 has to read as 09:00 here too
                      (#1369). Untimed todos pass "" and get the spacer that
                      used to be unconditional. */}
                  <TimeCell label={todo.startTime} />
                  {/* The same control the carryover rows draw (#1442) — the
                      paper had a 16px hand-drawn box here and the shared 20px
                      glyph a few rows down, so one page showed two kinds of
                      checkbox. It sits beside the title button, not inside it:
                      it is a button itself, and this file's a11y invariant is
                      that no button nests in another. 朱 rather than the app
                      accent, as on the carryover rows and 夕刊.
                      `itemName` is the row's own title (#1486): the paper can
                      print five todos, and a checkbox that only says
                     「ステータス: 未着手」leaves the reader who cannot see the
                      title beside it with five identical controls. */}
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
                    onClick={() => onToggleTodo(todo.id)}
                    className="min-w-0 text-left"
                  >
                    <span
                      className={
                        todo.status === "DONE"
                          ? "text-sm text-lumen-text-secondary line-through"
                          : "text-sm text-lumen-text"
                      }
                    >
                      {todo.title}
                    </span>
                  </button>
                  <RowActions>
                    <EditJumpButton
                      onClick={onJumpToTodos}
                      label={labels.edit}
                      hint={labels.jumpToTodos}
                    />
                    <DeleteRowButton
                      onClick={() => onDeleteTodo(todo.id)}
                      label={labels.delete}
                      hint={labels.deleteTodoHint}
                    />
                  </RowActions>
                </div>
                {/* Indented past the empty time column + checkbox so the
                    purpose hangs under its own todo's title: the 56px time
                    column, the 12px gap, the 44px checkbox, the 12px gap. */}
                {todo.purposes.length > 0 && (
                  <p className="ml-[124px] mt-0.5 text-xs text-lumen-text-secondary">
                    <span className="font-semibold text-lumen-briefing-kohaku">
                      ◈ {todo.purposes.join(" ・ ")}
                    </span>
                  </p>
                )}
              </li>
            ))}
            {/* The hairline between the two kinds of row. Decorative only —
                it separates, it is not an item — and omitted entirely when
                one side of it is empty. */}
            {data.todos.length > 0 && data.schedule.length > 0 && (
              <li
                aria-hidden="true"
                className="my-1.5 border-t border-lumen-border"
              />
            )}
            {scheduleRows.map((item) => (
              <li key={item.id} className="flex min-h-11 items-center gap-3">
                <TimeCell
                  label={item.isAllDay ? labels.allDay : item.startTime}
                />
                {/* No completion mark and no strikethrough (#1373): an event
                    has no "done" any more, so the paper reads the schedule
                    rather than asking the user to tick it off. The todo rows
                    below keep their checkbox. */}
                <span className="min-w-0 text-sm text-lumen-text">
                  {item.title}
                </span>
                {item.isRoutine && (
                  <span className="rounded-full border border-lumen-briefing-kohaku bg-lumen-briefing-kohaku-subtle px-2 text-xs text-lumen-briefing-kohaku">
                    {labels.routineTag}
                  </span>
                )}
                {/* Last in the row so `ml-auto` lands it on the right edge —
                    the routine tag keeps its place beside the title. */}
                <RowActions>
                  <EditJumpButton
                    onClick={onJumpToSchedule}
                    label={labels.edit}
                    hint={labels.jumpToSchedule}
                  />
                  <DeleteRowButton
                    onClick={() => onDeleteScheduleItem(item.id)}
                    label={labels.delete}
                    hint={labels.deleteScheduleHint}
                  />
                </RowActions>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Carryover ─────────────────────────────────────────────
          The paper's last section now that「きのうまでの自分」has moved to the
          detail panel (#938). No border of its own, as before: the rule above
          it is the previous section's `border-b`, so the ruled rhythm is
          unchanged by the removal. */}
      {data.carryover.length > 0 && (
        <section className="py-5">
          <BlockHead title={labels.carryoverTitle} />
          <ul className="space-y-1">
            {data.carryover.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 text-sm text-lumen-text-secondary"
              >
                {/* The paper's left rail, held at the width the schedule rows
                    hold it (#1368). The label is「3日目」on one row and
                    「12日目」on the next, so a column that sizes itself to its
                    own text hands each row a different left edge — and the
                    checkbox after it visibly steps sideways down the list.
                    tabular-nums keeps the digits themselves from stepping. */}
                <span className="w-14 flex-shrink-0 text-xs font-bold tabular-nums text-lumen-briefing-shu">
                  {item.daysLabel}
                </span>
                {/* The one todo checkbox (#1368). 朱 rather than the app
                    accent, as on 夕刊: a mark the user made is the paper's own
                    voice, not the app's. */}
                <TodoStatusCheckbox
                  status={item.completed ? "DONE" : "NOT_STARTED"}
                  onChange={() => onToggleTodo(item.id)}
                  labels={labels}
                  label={labels.todoStatus}
                  accentClassName="text-lumen-briefing-shu"
                />
                <button
                  type="button"
                  onClick={() => onToggleTodo(item.id)}
                  className="min-w-0 text-left"
                >
                  <span className={item.completed ? "line-through" : undefined}>
                    {item.title}
                  </span>
                </button>
                {/* Carryover keeps the jump alone: #585 scopes the delete to
                    今日のスケジュール and 今日の Todo, and a carryover row is
                    a past day's todo showing through — deleting it here would
                    act on a day the paper is not editing. */}
                <RowActions>
                  <EditJumpButton
                    onClick={onJumpToTodos}
                    label={labels.edit}
                    hint={labels.jumpToTodos}
                  />
                </RowActions>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
