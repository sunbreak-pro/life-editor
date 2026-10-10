import { cn } from "../cn";

/*
 * The day's morning record above the Daily body (#2123, plan Step 13 /
 * D-20261007-briefing-1): Claude's comment from the morning paper and the
 * day's 宣言, read for the host by `readMorningRecord`.
 *
 * Neither is part of the day's one text, so the body editor never shows them
 * (D-20261006-main-6). An old day still keeps both as sections of its body,
 * and heading-less text the user wrote after them belongs to those sections;
 * this block is where that text stays visible. Read-only — the morning paper
 * is where the comment comes from, and nothing writes a 宣言 any more.
 *
 * Pure presentation (§6.4). The host leaves it out when both halves are empty.
 */

export interface DailyMorningNoteLabels {
  /** Accessible name of the block —「朝の記録」. */
  region: string;
  comment: string;
  intention: string;
}

export interface DailyMorningNoteProps {
  /** Comment paragraphs, trimmed; [] when there is none. */
  comment: string[];
  /** The 宣言 lines joined by "\n"; "" when there is none. */
  intention: string;
  labels: DailyMorningNoteLabels;
  className?: string;
}

export function DailyMorningNote({
  comment,
  intention,
  labels,
  className,
}: DailyMorningNoteProps): React.JSX.Element {
  const intentionLines = intention.split("\n").filter((l) => l.trim() !== "");
  return (
    <section
      aria-label={labels.region}
      data-testid="daily-morning-note"
      className={cn(
        // A capped height that scrolls inside its own border: a long old
        // comment must not push the body editor out of the column (#2122).
        "mb-3 flex max-h-40 shrink-0 flex-col gap-2 overflow-y-auto rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary px-5 py-3",
        className,
      )}
    >
      {comment.length > 0 && (
        <div>
          <h2 className="mb-0.5 text-xs font-bold tracking-[0.2em] text-lumen-text-secondary">
            {labels.comment}
          </h2>
          {comment.map((p, i) => (
            <p
              key={i}
              className="text-sm leading-relaxed text-lumen-text [&+&]:mt-1"
            >
              {p}
            </p>
          ))}
        </div>
      )}
      {intentionLines.length > 0 && (
        <div>
          <h2 className="mb-0.5 text-xs font-bold tracking-[0.2em] text-lumen-text-secondary">
            {labels.intention}
          </h2>
          {intentionLines.map((line, i) => (
            <p key={i} className="text-sm leading-relaxed text-lumen-text">
              {line}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
