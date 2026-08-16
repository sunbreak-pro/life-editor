import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Check,
  Circle,
  Plus,
  Sunrise,
  Trash2,
} from "lucide-react";
import type { TodoNode, TodoStatus } from "../../types/todoTree";
import type { TimerSession } from "../../types/timer";
import { SkeletonList } from "../SkeletonList";
import {
  StreakDisplay,
  type StreakDisplayLabels,
} from "../Analytics/StreakDisplay";
import {
  TodoCompletionTrend,
  type TodoCompletionTrendLabels,
} from "../Analytics/TodoCompletionTrend";
import {
  WorkBreakBalance,
  type WorkBreakBalanceLabels,
} from "../Analytics/WorkBreakBalance";
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
 * The visual zone deliberately reuses the three Analytics widgets
 * (StreakDisplay / TodoCompletionTrend / WorkBreakBalance) — the Analytics
 * section shrink decision (redesign doc §3): the dashboards freeze, these
 * three move in here. Their labels are re-resolved by the host from the
 * existing analytics.* i18n keys, so no copy is duplicated.
 */

/** One row of「今日のスケジュール」— today's schedule, host-shaped. */
export interface BriefingScheduleEntry {
  id: string;
  title: string;
  /** "HH:MM" (empty for all-day). */
  startTime: string;
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
  /** Timer sessions — feeds StreakDisplay + WorkBreakBalance. */
  sessions: TimerSession[];
  /** Full todo tree — feeds TodoCompletionTrend. */
  todoNodes: TodoNode[];
}

export interface BriefingLabels {
  masthead: string;
  focusLabel: string;
  aiTitle: string;
  aiSource: string;
  noBriefing: string;
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
  vizTitle: string;
  carryoverTitle: string;
  toggleComplete: string;
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
  streakLabels: StreakDisplayLabels;
  trendLabels: TodoCompletionTrendLabels;
  balanceLabels: WorkBreakBalanceLabels;
  /** Today's declaration (宣言 — Step 4), newline-separated lines. */
  intentionText: string;
  /** Every keystroke — the host owns draft state + debounced persistence. */
  onIntentionChange: (text: string) => void;
  /** Blur — the host flushes a pending debounced save. */
  onIntentionBlur: () => void;
  /**
   * Standing 週 / 月 / 年 goals (#872) — text per period, newline-separated.
   * They live in one reserved note (goalSections.ts), not in the daily, and
   * never roll over: only the labels below say which period is showing.
   */
  goals: Record<GoalPeriod, string>;
  /** Copy of the three goal fields, period ranges included (host-formatted). */
  goalLabels: GoalsBlockLabels;
  /** Every keystroke in a goal field — same draft + debounce deal as 宣言. */
  onGoalChange: (period: GoalPeriod, text: string) => void;
  /** Blur on a goal field — the host flushes a pending debounced save. */
  onGoalBlur: () => void;
  /** Completes / un-completes a schedule item (host → DataService). */
  onToggleScheduleItem: (id: string) => void;
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
  hint?: string;
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

export function BriefingView({
  loading,
  data,
  labels,
  streakLabels,
  trendLabels,
  balanceLabels,
  intentionText,
  onIntentionChange,
  onIntentionBlur,
  goals,
  goalLabels,
  onGoalChange,
  onGoalBlur,
  onToggleScheduleItem,
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

      {/* ── Focus line ───────────────────────────────────────────── */}
      <section className="border-b border-lumen-border px-2 py-6 text-center">
        <p className="mb-2 text-xs font-bold tracking-[0.3em] text-lumen-briefing-shu">
          {labels.focusLabel}
        </p>
        {briefing?.focus !== null && briefing?.focus !== undefined ? (
          <p className="font-serif text-xl font-semibold leading-relaxed text-lumen-text">
            {briefing.focus}
          </p>
        ) : (
          <p className="flex items-center justify-center gap-2 text-sm text-lumen-text-secondary">
            <Sunrise size={16} aria-hidden="true" />
            {labels.noBriefing}
          </p>
        )}
      </section>

      {/* ── AI comment (rest of the briefing section) ────────────── */}
      {briefing !== null && briefing.paragraphs.length > 0 && (
        <section className="border-b border-lumen-border py-5">
          <BlockHead title={labels.aiTitle} hint={labels.aiSource} />
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
              <li key={todo.id} className="py-1">
                <div className="flex items-baseline gap-3">
                  {/* The schedule rows' time column, empty: a todo has no
                      clock, and holding the width is what keeps every title
                      on one straight edge with the timed rows below. */}
                  <span aria-hidden="true" className="w-14 flex-shrink-0" />
                  <button
                    type="button"
                    onClick={() => onToggleTodo(todo.id)}
                    className="flex min-w-0 items-center gap-2.5 text-left"
                  >
                    <span
                      aria-hidden="true"
                      className={
                        todo.status === "DONE"
                          ? "grid h-4 w-4 flex-shrink-0 place-items-center rounded bg-lumen-briefing-shu text-lumen-on-accent"
                          : "h-4 w-4 flex-shrink-0 rounded border border-lumen-border-strong"
                      }
                    >
                      {todo.status === "DONE" && <Check size={11} />}
                    </span>
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
                    purpose hangs under its own todo's title. */}
                {todo.purposes.length > 0 && (
                  <p className="ml-[82px] mt-0.5 text-xs text-lumen-text-secondary">
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
              <li key={item.id} className="flex items-baseline gap-3 py-1">
                <span className="w-14 flex-shrink-0 text-xs font-bold tabular-nums text-lumen-briefing-shu">
                  {item.isAllDay ? labels.allDay : item.startTime}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleScheduleItem(item.id)}
                  aria-label={labels.toggleComplete}
                  className="flex-shrink-0 self-center text-lumen-text-secondary transition-colors hover:text-lumen-accent"
                >
                  {item.completed ? (
                    <Check size={15} className="text-lumen-briefing-shu" />
                  ) : (
                    <Circle size={15} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleScheduleItem(item.id)}
                  className={
                    item.completed
                      ? "min-w-0 text-left text-sm text-lumen-text-secondary line-through transition-colors hover:text-lumen-accent"
                      : "min-w-0 text-left text-sm text-lumen-text transition-colors hover:text-lumen-accent"
                  }
                >
                  {item.title}
                </button>
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

      {/* ── Visual zone — the 3 adopted Analytics widgets ────────── */}
      <section className="border-b border-lumen-border py-5">
        <BlockHead title={labels.vizTitle} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StreakDisplay sessions={data.sessions} labels={streakLabels} />
          <TodoCompletionTrend
            nodes={data.todoNodes}
            days={7}
            labels={trendLabels}
          />
          <div className="sm:col-span-2">
            <WorkBreakBalance
              sessions={data.sessions}
              days={7}
              labels={balanceLabels}
            />
          </div>
        </div>
      </section>

      {/* ── Carryover ────────────────────────────────────────────── */}
      {data.carryover.length > 0 && (
        <section className="py-5">
          <BlockHead title={labels.carryoverTitle} />
          <ul className="space-y-1">
            {data.carryover.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 text-sm text-lumen-text-secondary"
              >
                <span className="font-bold text-lumen-briefing-shu">
                  {item.daysLabel}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleTodo(item.id)}
                  className="flex min-w-0 items-center gap-2.5 text-left"
                >
                  <span
                    aria-hidden="true"
                    className={
                      item.completed
                        ? "grid h-4 w-4 flex-shrink-0 place-items-center rounded bg-lumen-briefing-shu text-lumen-on-accent"
                        : "h-4 w-4 flex-shrink-0 rounded border border-lumen-border-strong"
                    }
                  >
                    {item.completed && <Check size={11} />}
                  </span>
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
