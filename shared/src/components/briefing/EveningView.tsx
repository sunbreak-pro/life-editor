import { useId, type ReactNode } from "react";
import { ArrowRight, CheckCircle2, Star } from "lucide-react";
import type { TodoStatus } from "../../types/todoTree";
import { SkeletonList } from "../SkeletonList";
import { TodoStatusCheckbox } from "../TodoStatusCheckbox";
import {
  EveningEventRow,
  EveningTomorrowRow,
  type EveningEventEntry,
  type EveningRowLabels,
} from "./EveningRows";
import type { EveningGoalMove, EveningTomorrowCandidate } from "./eveningDay";
import { GOAL_CHIP_ACHIEVED, GOAL_CHIP_UNACHIEVED } from "./GoalProgressDelta";
import { IntentionField } from "./IntentionField";

/*
 * EveningView — the evening-paper (夕刊) closing surface (#263, F-6).
 *
 * Pure presentation (§6.4): no DataService, no useTranslation — the host
 * (web/src/briefing/BriefingScreen.tsx) aggregates data, owns the section-
 * merge persistence, and injects everything through props. The TipTap editor
 * is a host concern too (it lives in web/), so it arrives as `editorSlot`.
 * Layout language matches BriefingView's 紙面: centered reading column,
 * double-rule masthead, 朱 (lumen-briefing-shu) for marks, 琥珀
 * (lumen-briefing-kohaku) for annotations — lumen-* tokens only.
 *
 * #2107 rebuilt the paper around the plan's Step 8: an issue number, the
 * goals the day moved, what happened (with a one-line note per row), todos to
 * put on tomorrow, and a note to tomorrow's self as the last block. The
 * morning declaration is no longer read back here (its data stays — the
 * morning paper still edits it).
 *
 * Neither the remaining-todo nor the upcoming-schedule block is ever copied
 * into the daily body (F-6: analysis reads raw data via get_today_context; the
 * body is the user's own reflection). The todo rows are still ACTIONABLE
 * though — closing the day means moving things along, and #796 gave them the
 * same three statuses a Todo has everywhere else in the app.
 */

/** One row of「残りの Todo」(today's unfinished + open carryover). */
export interface EveningTodoEntry {
  id: string;
  title: string;
  /** Optional annotation, e.g. the carryover "N日目" label (host-formatted). */
  meta?: string;
  /**
   * Not started / In progress / Done — the Todo's real state, not a boolean
   * flattening of it (#796). A row moved to DONE **today** stays on the list
   * struck through rather than vanishing under the finger that tapped it.
   */
  status: TodoStatus;
}

/** One read-only row of「今後の予定」(rest of today + tomorrow). */
export interface EveningScheduleEntry {
  id: string;
  title: string;
  /** "HH:MM" (empty for all-day). */
  startTime: string;
  isAllDay: boolean;
  /** True for tomorrow's items — rendered with the tomorrow tag. */
  isTomorrow: boolean;
}

export interface EveningLabels extends EveningRowLabels {
  masthead: string;
  moodTitle: string;
  /** Aria labels for the five stars, index 0 =「気分 1/5」etc. */
  moodStars: string[];
  reflectionTitle: string;
  /**
   * Saved-state caption next to the reflection title (host-computed).
   *
   * Omitted while the day holds no reflection and no mood (#1822). A
   *「保存済み」beside an empty page is a receipt for a write that never
   * happened.
   */
  savedCaption?: string;
  /**
   * Heading of the 明日の自分へ block (#1048, renamed by #2107) — the input
   * whose text TOMORROW's morning paper prints as its focus line.
   */
  focusTitle: string;
  /** Placeholder of the focus field. */
  focusPlaceholder: string;
  todosTitle: string;
  noTodos: string;
  /**
   * Copy for the per-row status control (#796) — `todoStatus` names what the
   * button controls, the three `status*` members name each value. Same words
   * the Todos section uses (todoDetail.*), injected rather than re-worded.
   */
  todoStatus: string;
  statusNotStarted: string;
  statusDone: string;
  upcomingTitle: string;
  noUpcoming: string;
  tomorrowTag: string;
  goalsTitle: string;
  noGoals: string;
  /** The achieved chip's word (「達成」) — never colour alone. */
  goalAchieved: string;
  /** The not-yet chip:「あと n 件」. Calmer than「未達」mid-period (#2107). */
  goalRemaining: (count: number) => string;
  eventsTitle: string;
  noEvents: string;
  tomorrowTitle: string;
  noTomorrow: string;
  openDaily: string;
  /** Accessible name of the button, naming the day it opens. */
  openDailyLabel: string;
}

export interface EveningViewProps {
  loading: boolean;
  /** Host-formatted date line, e.g. "2026年7月18日 土曜日". */
  dateLine: string;
  /** Current mood 1–5 (persisted or draft), null when unset. */
  mood: number | null;
  /** Star tap — host persists「気分: n/5」(tapping the current value clears). */
  onSelectMood: (mood: number) => void;
  /** The host-mounted TipTap editor bound to the day's one text (readDailyText / writeDailyText, #2107). */
  editorSlot: ReactNode;
  /**
   * Tomorrow's focus (#1048) — the draft-or-stored text of the focus note's
   * section keyed to TOMORROW. Writing it here is part of closing the day;
   * the next morning's paper prints it as「今日のフォーカス」. Editable at
   * every width, like the mood stars.
   */
  focusText: string;
  /** Every keystroke in the focus field — host owns draft + debounced save. */
  onFocusChange: (text: string) => void;
  /** Blur on the focus field — the host flushes a pending debounced save. */
  onFocusBlur: () => void;
  todos: EveningTodoEntry[];
  /**
   * Move a todo to the next status straight from the paper (#796). The block
   * used to draw a checkbox-shaped <span> with nothing listening to it, which
   * both flattened three states into two and left the row unpressable.
   */
  onSetTodoStatus: (id: string, status: TodoStatus) => void;
  schedule: EveningScheduleEntry[];
  /**
   * 「夕刊 第 42 号 · 5 日連続」, host-formatted (#2107). Undefined hides the
   * line — the host passes nothing on a day before the first issue rather
   * than print「第 0 号」.
   */
  issueLine?: string;
  /**
   * 今日進んだ目標 — current goals the day's completions moved. null while
   * the goals are still loading: the block is left out instead of printing
   * a "none" that is not known yet.
   */
  goalMoves: EveningGoalMove[] | null;
  /** 今日の出来事 — events, completed todos and work, in time order. */
  events: EveningEventEntry[];
  /** The block's count line (「予定 3 · Todo 2/4 · 作業 1時間50分」). */
  eventsSummary?: string;
  /** Save one row's note; called only when the text changed. */
  onSaveEventNote: (key: string, text: string) => void;
  /** 明日の予定に置く — the candidates, goal-linked first. */
  tomorrowTodos: EveningTomorrowCandidate[];
  /** Put a todo on tomorrow; `time` "HH:MM", or null for all-day. */
  onPlaceTomorrow: (id: string, time: string | null) => void;
  /** 「Daily に移動」. Undefined hides the button. */
  onOpenDaily?: () => void;
  labels: EveningLabels;
  /**
   * In-body 朝刊/夕刊 switcher for the NARROW layout (#318) — same slot as
   * BriefingView's. AppShell renders its header slot on the wide branch only,
   * so below 768px the host re-issues the tab band here. Undefined on the wide
   * layout, where the SectionHeader keeps owning the tabs (unchanged).
   *
   * Pass `undefined` / `null` to omit it — NOT `cond && <node>`, whose `false`
   * would clear the guard and leave an empty ruled band on the paper.
   */
  tabSwitcher?: ReactNode;
}

/** Section heading row — same 段標 idiom as BriefingView's BlockHead. */
function BlockHead({
  id,
  title,
  hint,
}: {
  id: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h3
        id={id}
        className="flex items-center gap-2.5 text-xs font-bold tracking-[0.25em] text-lumen-text-secondary"
      >
        <span
          aria-hidden="true"
          className="inline-block h-3.5 w-[7px] bg-lumen-briefing-shu"
        />
        {title}
      </h3>
      {hint !== undefined && (
        <span className="text-xs tracking-wider text-lumen-briefing-kohaku">
          {hint}
        </span>
      )}
    </div>
  );
}

/*
 * One mood star's box (#1559).
 *
 * The 390px audit measured these at 35×35: a 26px glyph in `p-1`. Five of them
 * sit `gap-1.5` apart in a centred row, so the floor is bought by growing the
 * BOXES rather than by hanging a `::after` over each — the extensions of two
 * neighbours 6px apart would overlap and the row would answer the wrong star.
 * Five 44px boxes plus four 6px gaps come to 244px, well inside the 343px the
 * paper prints on, so nothing is displaced by the growth.
 *
 * `max-md:` and never a bare `min-h-11`: one component draws this row at every
 * width, and the Desktop star is the 34px box #263 chose.
 *
 * `inline-flex` + centring is what makes the floor mean anything — without it
 * the glyph would sit against the box's leading edge once the box is wider
 * than its content. It is a no-op at Desktop size, where the box already hugs
 * the 26px star.
 */
const MOOD_STAR_BASE =
  "inline-flex items-center justify-center p-1 transition-transform hover:scale-110 max-md:min-h-11 max-md:min-w-11";

export function EveningView({
  loading,
  dateLine,
  mood,
  onSelectMood,
  editorSlot,
  focusText,
  onFocusChange,
  onFocusBlur,
  todos,
  onSetTodoStatus,
  schedule,
  issueLine,
  goalMoves,
  events,
  eventsSummary,
  onSaveEventNote,
  tomorrowTodos,
  onPlaceTomorrow,
  onOpenDaily,
  labels,
  tabSwitcher,
}: EveningViewProps): React.JSX.Element {
  // Every block is a region named by its heading, so assistive tech can jump
  // between them — and the blocks can be told apart without leaning on copy.
  const idBase = useId();
  const headId = (block: string) => `${idBase}-${block}`;

  if (loading) {
    // Mirrors BriefingView: the switcher stays reachable while data loads.
    return (
      <div className="mx-auto w-full max-w-2xl py-8">
        {tabSwitcher != null && <div className="mb-4 px-2">{tabSwitcher}</div>}
        <SkeletonList rows={8} rowHeight={44} gap={12} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl pb-16">
      {/* ── 朝刊/夕刊 switcher — narrow layout only (#318) ──────────
          ABOVE the masthead (#879), same order as the morning paper: the
          hamburger row belongs at the top of the screen the way every other
          section draws it. Undefined on the wide layout — nothing moves. */}
      {tabSwitcher != null && (
        <div className="border-b border-lumen-border px-2 py-3">
          {tabSwitcher}
        </div>
      )}

      {/* ── Masthead — the title deliberately keeps the newspaper serif
          (#269) regardless of the Settings font; body copy follows the
          global preference (#556). `break-keep` for the same reason the
          morning paper carries it: 「LIFE EDITOR 夕刊」wrapped between 夕 and
          刊 at 390px, and keep-all leaves the space before the paper's name
          as the only break point (#1513). ─────────────────────────── */}
      <header className="border-b-4 border-double border-lumen-border-strong pb-4 pt-6 text-center">
        <h2 className="break-keep font-serif text-2xl font-semibold tracking-[0.3em] text-lumen-text">
          {labels.masthead}
        </h2>
        <p className="mt-2 text-xs tracking-[0.2em] text-lumen-text-secondary">
          {dateLine}
        </p>
        {/* Issue number + streak (#2107). Under the h2, not inside it: the
            nameplate's accessible name stays the paper's name. */}
        {issueLine !== undefined && (
          <p className="mt-1 text-xs tracking-[0.2em] text-lumen-briefing-kohaku">
            {issueLine}
          </p>
        )}
      </header>

      {/* ── Mood (気分: n/5 convention behind the stars). A star is also
          what publishes the day's paper (#2107) — the host stamps it. ── */}
      <section
        aria-labelledby={headId("mood")}
        className="border-b border-lumen-border px-2 py-6 text-center"
      >
        <p
          id={headId("mood")}
          className="mb-3 text-xs font-bold tracking-[0.3em] text-lumen-briefing-shu"
        >
          {labels.moodTitle}
        </p>
        <div className="flex items-center justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = mood !== null && n <= mood;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onSelectMood(n)}
                aria-label={labels.moodStars[n - 1]}
                aria-pressed={mood === n}
                className={
                  filled
                    ? `${MOOD_STAR_BASE} text-lumen-briefing-shu`
                    : `${MOOD_STAR_BASE} text-lumen-text-secondary hover:text-lumen-briefing-shu`
                }
              >
                <Star
                  size={26}
                  aria-hidden="true"
                  fill={filled ? "currentColor" : "none"}
                />
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Goals the day moved (#2107): before → after, judged by the same
          rule as everywhere (judgeGoals twice). Achieved and not-yet are both
          shown, calmly — mint for done, 朱 on its subtle ground for the rest,
          and always a word beside the colour. ───────────────────────── */}
      {goalMoves !== null && (
        <section
          aria-labelledby={headId("goals")}
          className="border-b border-lumen-border py-5"
        >
          <BlockHead id={headId("goals")} title={labels.goalsTitle} />
          {goalMoves.length === 0 ? (
            <p className="text-sm text-lumen-text-secondary">
              {labels.noGoals}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {goalMoves.map((move) => (
                <li
                  key={move.goalId}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                >
                  <span className="min-w-0 text-lumen-text">{move.title}</span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <span className="text-lumen-text-tertiary">
                      {move.before.done}/{move.before.total}
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-3.5 text-lumen-text-tertiary"
                    />
                    <span className="font-medium text-lumen-text">
                      {move.after.done}/{move.after.total}
                    </span>
                  </span>
                  {move.after.achieved ? (
                    <span className={`${GOAL_CHIP_ACHIEVED} gap-1`}>
                      <CheckCircle2
                        aria-hidden="true"
                        className="size-3.5 text-lumen-accent-secondary"
                      />
                      {labels.goalAchieved}
                    </span>
                  ) : (
                    <span className={GOAL_CHIP_UNACHIEVED}>
                      {labels.goalRemaining(
                        Math.max(0, move.after.total - move.after.done),
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── What happened today (#2107) — events, completed todos and work
          on one time line, each with room for a one-line note. ───────── */}
      <section
        aria-labelledby={headId("events")}
        className="border-b border-lumen-border py-5"
      >
        <BlockHead
          id={headId("events")}
          title={labels.eventsTitle}
          hint={eventsSummary}
        />
        {events.length === 0 ? (
          <p className="text-sm text-lumen-text-secondary">{labels.noEvents}</p>
        ) : (
          <ul>
            {events.map((entry) => (
              <EveningEventRow
                key={entry.key}
                entry={entry}
                labels={labels}
                onSaveNote={onSaveEventNote}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ── Reflection (the evening editor — host-mounted TipTap). Since
          #2107 it edits the day's ONE text, which can be long — so the frame
          caps its height and scrolls inside, and the blocks below stay on
          screen. The ground is the paper's own opaque bg-lumen-bg: the old
          bg-lumen-surface is no token and fell through to transparent. ── */}
      <section
        aria-labelledby={headId("reflection")}
        className="border-b border-lumen-border py-5"
      >
        <BlockHead
          id={headId("reflection")}
          title={labels.reflectionTitle}
          hint={labels.savedCaption}
        />
        <div className="max-h-[60vh] overflow-y-auto rounded-lumen-md border border-lumen-border bg-lumen-bg">
          {editorSlot}
        </div>
      </section>

      {/* ── Put on tomorrow (#2107) — closing today includes deciding
          tomorrow; goal-linked todos first. ─────────────────────────── */}
      <section
        aria-labelledby={headId("tomorrow")}
        className="border-b border-lumen-border py-5"
      >
        <BlockHead id={headId("tomorrow")} title={labels.tomorrowTitle} />
        {tomorrowTodos.length === 0 ? (
          <p className="text-sm text-lumen-text-secondary">
            {labels.noTomorrow}
          </p>
        ) : (
          <ul>
            {tomorrowTodos.map((entry) => (
              <EveningTomorrowRow
                key={entry.id}
                entry={entry}
                labels={labels}
                onPlace={onPlaceTomorrow}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ── Remaining todos ─────────────────────────────────────────── */}
      <section
        aria-labelledby={headId("todos")}
        className="border-b border-lumen-border py-5"
      >
        <BlockHead id={headId("todos")} title={labels.todosTitle} />
        {todos.length === 0 ? (
          <p className="text-sm text-lumen-text-secondary">{labels.noTodos}</p>
        ) : (
          <ul>
            {todos.map((todo) => (
              <li
                key={todo.id}
                className="flex items-center gap-1.5 border-b border-dashed border-lumen-border last:border-b-0"
              >
                {/* 朱 is the user's own action voice on the paper, so the
                    control wears it rather than the app accent. */}
                <TodoStatusCheckbox
                  status={todo.status}
                  onChange={(next) => onSetTodoStatus(todo.id, next)}
                  labels={labels}
                  label={labels.todoStatus}
                  accentClassName="text-lumen-briefing-shu"
                />
                <span
                  className={
                    todo.status === "DONE"
                      ? "text-sm text-lumen-text-secondary line-through"
                      : "text-sm text-lumen-text"
                  }
                >
                  {todo.title}
                </span>
                {todo.meta !== undefined && (
                  <span className="text-xs font-bold text-lumen-briefing-shu">
                    {todo.meta}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Upcoming schedule (display only) ─────────────────────────── */}
      <section
        aria-labelledby={headId("upcoming")}
        className="border-b border-lumen-border py-5"
      >
        <BlockHead id={headId("upcoming")} title={labels.upcomingTitle} />
        {schedule.length === 0 ? (
          <p className="text-sm text-lumen-text-secondary">
            {labels.noUpcoming}
          </p>
        ) : (
          <ul className="space-y-1">
            {schedule.map((item) => (
              <li key={item.id} className="flex items-baseline gap-3 py-1">
                <span className="w-14 flex-shrink-0 text-xs font-bold tabular-nums text-lumen-briefing-shu">
                  {item.isAllDay ? labels.allDay : item.startTime}
                </span>
                <span className="text-sm text-lumen-text">{item.title}</span>
                {item.isTomorrow && (
                  <span className="rounded-full border border-lumen-briefing-kohaku bg-lumen-briefing-kohaku-subtle px-2 text-xs text-lumen-briefing-kohaku">
                    {labels.tomorrowTag}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── A note to tomorrow (#1048; renamed and moved last by #2107) —
          朱, the user's own action voice. The text lands in the reserved
          focus note keyed to tomorrow, and tomorrow's morning paper prints
          it as its focus line. ───────────────────────────────────── */}
      <section aria-labelledby={headId("focus")} className="py-5">
        <BlockHead id={headId("focus")} title={labels.focusTitle} />
        <IntentionField
          value={focusText}
          placeholder={labels.focusPlaceholder}
          onChange={onFocusChange}
          onBlur={onFocusBlur}
          labelledBy={headId("focus")}
        />
      </section>

      {/* ── Continue in the Daily (#2107): the same text, on a wider page.
          Until the Daily body itself reads the one text (#2123), a day edited
          here shows that text in the Daily's 夕刊 card, not in its body. */}
      {onOpenDaily !== undefined && (
        <div className="pt-5 text-center">
          <button
            type="button"
            onClick={onOpenDaily}
            aria-label={labels.openDailyLabel}
            className="rounded-lumen-md border border-lumen-border px-4 py-2 text-sm text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11"
          >
            {labels.openDaily}
          </button>
        </div>
      )}
    </div>
  );
}
