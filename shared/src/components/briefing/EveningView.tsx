import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { SkeletonList } from "../SkeletonList";

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
 * The remaining-todo and upcoming-schedule blocks are DISPLAY ONLY (F-6:
 * they are never copied into the daily body — analysis reads raw data via
 * get_today_context; the body is the user's own reflection).
 */

/** One read-only row of「残りの Todo」(today's unfinished + open carryover). */
export interface EveningTodoEntry {
  id: string;
  title: string;
  /** Optional annotation, e.g. the carryover "N日目" label (host-formatted). */
  meta?: string;
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
  intentionTitle: string;
  reflectionTitle: string;
  /** Saved-state caption next to the reflection title (host-computed). */
  savedCaption: string;
  todosTitle: string;
  noTodos: string;
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
   * Today's declaration (宣言 section, newline-separated) shown back while
   * the day is closed — null hides the block. Display only (Step 4: the
   * critique round-trip is written in the reflection / next morning).
   */
  intention: string | null;
  todos: EveningTodoEntry[];
  schedule: EveningScheduleEntry[];
  labels: EveningLabels;
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
        <span className="text-[10px] tracking-wider text-lumen-briefing-kohaku">
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
  intention,
  todos,
  schedule,
  labels,
}: EveningViewProps): React.JSX.Element {
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl py-8">
        <SkeletonList rows={8} rowHeight={44} gap={12} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl pb-16">
      {/* ── Masthead ─────────────────────────────────────────────── */}
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
        <p className="mb-3 text-[10px] font-bold tracking-[0.3em] text-lumen-briefing-shu">
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

      {/* ── This morning's intention (宣言 — display only) ───────── */}
      {intention !== null && (
        <section className="border-b border-lumen-border py-5">
          <BlockHead title={labels.intentionTitle} />
          <div className="rounded-lumen-md border-l-2 border-lumen-briefing-kohaku bg-lumen-briefing-kohaku-subtle px-4 py-3">
            {intention.split("\n").map((line, i) => (
              <p
                key={i}
                className="font-serif text-sm leading-relaxed text-lumen-text [&+&]:mt-1"
              >
                {line}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* ── Reflection (the evening editor — host-mounted TipTap) ── */}
      <section className="border-b border-lumen-border py-5">
        <BlockHead title={labels.reflectionTitle} hint={labels.savedCaption} />
        <div className="rounded-lumen-md border border-lumen-border bg-lumen-surface">
          {editorSlot}
        </div>
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
                className="flex items-center gap-2.5 border-b border-dashed border-lumen-border py-2 last:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className="h-4 w-4 flex-shrink-0 rounded border border-lumen-border-strong"
                />
                <span className="text-sm text-lumen-text">{todo.title}</span>
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
                  <span className="rounded-full border border-lumen-briefing-kohaku bg-lumen-briefing-kohaku-subtle px-2 text-[10px] text-lumen-briefing-kohaku">
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
