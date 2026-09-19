import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { cn } from "../cn";
import { FOCUS_RING_TIGHT } from "../styleTokens";

/*
 * 夕刊カテゴリ (#1046) — the Daily tab's evening block, drawn UNDER the day's
 * body editor.
 *
 * The evening paper's writes (mood + reflection — eveningSection.ts) used to
 * surface inside the Daily body as raw「夕刊」heading text. The body editor
 * now mounts the day WITHOUT that section (stripEveningSection) and this card
 * renders it instead, alongside a compact read of the day's schedule — so
 * looking back at a day reads as a small closing page, not markup.
 *
 * Editable since #1680: with `onSelectMood` the stars become buttons (tap the
 * lit one again to clear, as on the evening paper), and `reflectionSlot`
 * replaces the printed lines with whatever the host mounts there — the Daily
 * host swaps a preview for the rich-text editor on press, exactly like the
 * evening paper's `editorSlot`. The schedule stays a read: it is Schedule's
 * data, not the daily's, so there is nothing here for it to save into.
 *
 * Pure presentation (§6.4): no DataService, no useTranslation — the host
 * (web/src/daily/DailyView.tsx) extracts the section, fetches the schedule
 * and injects everything through props. Visual language borrows the evening
 * paper's marks: 朱 (lumen-briefing-shu) for the day's own acts, serif for
 * the title — lumen-* tokens only, opaque surface.
 */

/** One compact row of the day's schedule. */
export interface DailyEveningScheduleEntry {
  id: string;
  title: string;
  /** "HH:MM" (ignored when isAllDay). */
  startTime: string;
  isAllDay: boolean;
}

export interface DailyEveningCardLabels {
  /** Card heading —「夕刊」. */
  title: string;
  /** Accessible name of the mood row, index 0 =「気分 1/5」etc. */
  moodStars: string[];
  /** Group name of the editable star row —「今日の気分」. Editable only. */
  moodGroup?: string;
  /** Heading of the schedule block. */
  scheduleTitle: string;
  allDay: string;
}

export interface DailyEveningCardProps {
  /** Mood 1–5 from the evening paper, null when the day has none. */
  mood: number | null;
  /** The reflection body as plain lines (host-extracted); [] when none. */
  reflectionLines: string[];
  /** The day's schedule, all-day rows first (host-sorted); [] when none. */
  schedule: DailyEveningScheduleEntry[];
  labels: DailyEveningCardLabels;
  /**
   * Makes the stars pressable. Receives the star pressed — the host decides
   * what a press on the already-lit star means (it clears).
   */
  onSelectMood?: (mood: number) => void;
  /**
   * Host-mounted reflection surface (preview ↔ editor). When given it is
   * drawn in place of `reflectionLines`, even when those are empty.
   */
  reflectionSlot?: ReactNode;
}

const MOOD_STAR_BUTTON =
  "inline-flex items-center justify-center rounded-lumen-sm p-0.5 transition-colors max-md:min-h-11 max-md:min-w-11";

/**
 * The evening category block. The HOST decides whether to render it at all —
 * this component draws whatever it is given and omits empty sub-blocks.
 */
export function DailyEveningCard({
  mood,
  reflectionLines,
  schedule,
  labels,
  onSelectMood,
  reflectionSlot,
}: DailyEveningCardProps): React.JSX.Element {
  return (
    <section className="mt-3 rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary px-5 py-4 shadow-lumen-sm">
      {/* ── Header — the evening paper's own voice: serif title, 朱 bar,
          the day's mood at the right edge ─────────────────────────── */}
      <div className="flex items-center justify-between border-b border-lumen-border pb-2.5">
        <h2 className="flex items-center gap-2.5 font-serif text-sm font-semibold tracking-[0.25em] text-lumen-text">
          <span
            aria-hidden="true"
            className="inline-block h-3.5 w-[7px] bg-lumen-briefing-shu"
          />
          {labels.title}
        </h2>
        {onSelectMood ? (
          <div
            role="group"
            aria-label={labels.moodGroup}
            className="flex items-center gap-0.5"
          >
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = mood !== null && n <= mood;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onSelectMood(n)}
                  aria-label={labels.moodStars[n - 1]}
                  aria-pressed={mood === n}
                  className={cn(
                    MOOD_STAR_BUTTON,
                    FOCUS_RING_TIGHT,
                    filled
                      ? "text-lumen-briefing-shu"
                      : "text-lumen-text-tertiary hover:text-lumen-briefing-shu",
                  )}
                >
                  <Star
                    size={15}
                    aria-hidden="true"
                    fill={filled ? "currentColor" : "none"}
                  />
                </button>
              );
            })}
          </div>
        ) : (
          mood !== null && (
            <span
              role="img"
              aria-label={labels.moodStars[mood - 1]}
              className="flex items-center gap-0.5"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={15}
                  aria-hidden="true"
                  className={
                    n <= mood
                      ? "text-lumen-briefing-shu"
                      : "text-lumen-text-tertiary"
                  }
                  fill={n <= mood ? "currentColor" : "none"}
                />
              ))}
            </span>
          )
        )}
      </div>

      {/* ── Reflection — the user's own closing words ─────────────── */}
      {reflectionSlot !== undefined ? (
        <div className="pt-3">{reflectionSlot}</div>
      ) : (
        reflectionLines.length > 0 && (
          <div className="pt-3">
            {reflectionLines.map((line, i) => (
              <p
                key={i}
                className="text-sm leading-relaxed text-lumen-text [&+&]:mt-1"
              >
                {line}
              </p>
            ))}
          </div>
        )
      )}

      {/* ── The day's schedule, compact ───────────────────────────── */}
      {schedule.length > 0 && (
        <div className="pt-3">
          <h3 className="mb-1.5 text-xs font-bold tracking-[0.2em] text-lumen-text-secondary">
            {labels.scheduleTitle}
          </h3>
          <ul>
            {schedule.map((item) => (
              <li
                key={item.id}
                className="flex items-baseline gap-3 border-b border-dashed border-lumen-border py-1 last:border-b-0"
              >
                <span className="w-14 flex-shrink-0 text-xs font-bold tabular-nums text-lumen-briefing-shu">
                  {item.isAllDay ? labels.allDay : item.startTime}
                </span>
                {/* No strikethrough (#1373): an event has no completion in
                    the UI, and the MCP tool's write must not surface as a
                    state with nothing here to clear it. */}
                <span className="text-sm text-lumen-text">{item.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
