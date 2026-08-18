import type { ReactNode } from "react";
import { Star } from "lucide-react";
import type { TodoStatus } from "../../types/todoTree";
import { SkeletonList } from "../SkeletonList";
import { TodoStatusCheckbox } from "../TodoStatusCheckbox";
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

export interface EveningLabels {
  masthead: string;
  moodTitle: string;
  /** Aria labels for the five stars, index 0 =「気分 1/5」etc. */
  moodStars: string[];
  /**
   * Heading of the 宣言 block. The host swaps the copy with the mode:
   * 「今朝の宣言」when it is the read-back of a morning artifact,
   * 「今日の宣言」when the narrow layout makes it a live input (#391).
   */
  intentionTitle: string;
  /**
   * Saved-state caption for the 宣言 block (host-computed). Rendered ONLY
   * while the block is editable — a read-only block has no save to report,
   * and a「保存済み」next to text you cannot type into is a lie. Also
   * omitted while the day has no declaration at all (#427).
   */
  intentionCaption?: string;
  /** Placeholder of the editable 宣言 field (narrow layout only). */
  intentionPlaceholder: string;
  reflectionTitle: string;
  /** Saved-state caption next to the reflection title (host-computed). */
  savedCaption: string;
  /**
   * Heading of the 明日のフォーカス block (#1048) — the input whose text
   * TOMORROW's morning paper prints as its focus line.
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
  allDay: string;
}

export interface EveningViewProps {
  loading: boolean;
  /** Host-formatted date line, e.g. "2026年7月18日 土曜日". */
  dateLine: string;
  /** Current mood 1–5 (persisted or draft), null when unset. */
  mood: number | null;
  /** Star tap — host persists「気分: n/5」(tapping the current value clears). */
  onSelectMood: (mood: number) => void;
  /** The host-mounted TipTap editor bound to the evening section body. */
  editorSlot: ReactNode;
  /**
   * Today's declaration (宣言 section, newline-separated). Empty string = no
   * declaration yet, which hides the whole block on the read-only (wide) path.
   */
  intentionText: string;
  /**
   * Turns the 宣言 block from a read-back into a live input (#391).
   *
   * Wide keeps the original reading: the declaration is a MORNING artifact the
   * evening paper shows back, and the SectionHeader tab band puts the editable
   * 朝刊 one click away. Below 768px the evening paper is a Quick capture
   * surface (mobile-scope #3) and the tab band is an in-body switcher, so the
   * block becomes the input itself — otherwise a phone user who lands on 夕刊
   * cannot declare at all (and gets no block whatsoever on a blank day).
   */
  intentionEditable: boolean;
  /** Every keystroke while editable — the host owns draft + debounced save. */
  onIntentionChange: (text: string) => void;
  /** Blur while editable — the host flushes a pending debounced save. */
  onIntentionBlur: () => void;
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
function BlockHead({ title, hint }: { title: string; hint?: string }) {
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
        <span className="text-xs tracking-wider text-lumen-briefing-kohaku">
          {hint}
        </span>
      )}
    </div>
  );
}

export function EveningView({
  loading,
  dateLine,
  mood,
  onSelectMood,
  editorSlot,
  intentionText,
  intentionEditable,
  onIntentionChange,
  onIntentionBlur,
  focusText,
  onFocusChange,
  onFocusBlur,
  todos,
  onSetTodoStatus,
  schedule,
  labels,
  tabSwitcher,
}: EveningViewProps): React.JSX.Element {
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
          global preference (#556) ─────────────────────────────────── */}
      <header className="border-b-4 border-double border-lumen-border-strong pb-4 pt-6 text-center">
        <h2 className="font-serif text-2xl font-semibold tracking-[0.3em] text-lumen-text">
          {labels.masthead}
        </h2>
        <p className="mt-2 text-xs tracking-[0.2em] text-lumen-text-secondary">
          {dateLine}
        </p>
      </header>

      {/* ── Mood (気分: n/5 convention behind the stars) ─────────── */}
      <section className="border-b border-lumen-border px-2 py-6 text-center">
        <p className="mb-3 text-xs font-bold tracking-[0.3em] text-lumen-briefing-shu">
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
                    ? "p-1 text-lumen-briefing-shu transition-transform hover:scale-110"
                    : "p-1 text-lumen-text-secondary transition-transform hover:scale-110 hover:text-lumen-briefing-shu"
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

      {/* ── Today's intention (宣言) — input on narrow, read-back on wide ─ */}
      {(intentionEditable || intentionText !== "") && (
        <section className="border-b border-lumen-border py-5">
          <BlockHead
            title={labels.intentionTitle}
            hint={intentionEditable ? labels.intentionCaption : undefined}
          />
          {intentionEditable ? (
            // 朱 (the user's action voice) — same field as the morning paper.
            <IntentionField
              value={intentionText}
              placeholder={labels.intentionPlaceholder}
              onChange={onIntentionChange}
              onBlur={onIntentionBlur}
            />
          ) : (
            // 琥珀 (context / annotation) — a morning artifact read back.
            <div className="rounded-lumen-md border-l-2 border-lumen-briefing-kohaku bg-lumen-briefing-kohaku-subtle px-4 py-3">
              {intentionText.split("\n").map((line, i) => (
                <p
                  key={i}
                  className="text-sm leading-relaxed text-lumen-text [&+&]:mt-1"
                >
                  {line}
                </p>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Reflection (the evening editor — host-mounted TipTap) ── */}
      <section className="border-b border-lumen-border py-5">
        <BlockHead title={labels.reflectionTitle} hint={labels.savedCaption} />
        <div className="rounded-lumen-md border border-lumen-border bg-lumen-surface">
          {editorSlot}
        </div>
      </section>

      {/* ── Tomorrow's focus (#1048) — 朱, the user's own action voice:
          closing today includes deciding tomorrow. The text lands in the
          reserved focus note keyed to tomorrow, and tomorrow's morning
          paper prints it as its focus line. ─────────────────────── */}
      <section className="border-b border-lumen-border py-5">
        <BlockHead title={labels.focusTitle} />
        <IntentionField
          value={focusText}
          placeholder={labels.focusPlaceholder}
          onChange={onFocusChange}
          onBlur={onFocusBlur}
        />
      </section>

      {/* ── Remaining todos (display only) ───────────────────────── */}
      <section className="border-b border-lumen-border py-5">
        <BlockHead title={labels.todosTitle} />
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

      {/* ── Upcoming schedule (display only) ─────────────────────── */}
      <section className="py-5">
        <BlockHead title={labels.upcomingTitle} />
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
    </div>
  );
}
