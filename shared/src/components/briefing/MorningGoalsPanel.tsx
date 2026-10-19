import { useState, type ReactNode } from "react";
import { ArrowUpRight, Link2 } from "lucide-react";
import type { GoalPeriodKind } from "../../types/goal";
import { isImeComposing } from "../../utils/imeGuard";
import { Button } from "../Button";
import { cn } from "../cn";
import { Input } from "../Input";
import { BRIEFING_HINT_CLASS } from "./briefingStyles";
import { GOALS_PER_PERIOD_LIMIT } from "./goalNoteMigration";
import {
  GoalStatusLine,
  QUIET_ACTION,
  type MorningGoalsLabels,
} from "./MorningGoalsBlock";
import type { MorningGoalLine, MorningGoals } from "./morningGoals";

/*
 * The goals panel the morning paper's「目標」button opens (#2286) — a
 * centred dialog on Desktop, a bottom sheet on a phone (the host picks the
 * frame). Everything the block used to hold and more: each current goal of
 * the year, month and week with its progress, its「Todo をつなぐ」, and its
 * title as the way into the goal's own panel (rename, achieved by hand —
 * Connect's GoalDetailPanel, which the host shows in place of this list).
 * This week's add field moved here unchanged (#2106 / #2213), and the
 * period-end review sits on top when anything is waiting for an answer.
 *
 * Pure presentation (§6.4), like the block.
 */

export interface MorningGoalsPanelProps {
  goals: MorningGoals;
  labels: MorningGoalsLabels;
  onLinkTodos: (goalId: string) => void;
  /** Opens one goal's own panel (GoalDetailPanel, in the host). */
  onSelectGoal: (goalId: string) => void;
  /** Resolves true once the goal exists (the field clears), false to keep it. */
  onCreateWeekGoal: (title: string) => Promise<boolean>;
  /**
   * Another goal write (a review answer) is in flight: adding waits for it,
   * so the two cannot both count the same free slot.
   */
  writing?: boolean;
  /** Omitted → no link to Connect (a host with no navigation). */
  onOpenGoals?: () => void;
  /** The period-end review card, drawn above the periods. */
  review?: ReactNode;
}

const KINDS: readonly GoalPeriodKind[] = ["year", "month", "week"];

function GoalRow({
  line,
  labels,
  onLinkTodos,
  onSelectGoal,
}: {
  line: MorningGoalLine;
  labels: MorningGoalsLabels;
  onLinkTodos: (goalId: string) => void;
  onSelectGoal: (goalId: string) => void;
}): React.JSX.Element {
  return (
    <li className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
      <button
        type="button"
        onClick={() => onSelectGoal(line.id)}
        aria-label={labels.openGoalFor(line.title)}
        className="min-w-0 flex-1 rounded-lumen-sm text-left text-base font-medium text-lumen-text hover:text-lumen-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11"
      >
        {line.title}
      </button>
      <GoalStatusLine
        title={line.title}
        progress={line.progress}
        labels={labels}
      />
      <button
        type="button"
        onClick={() => onLinkTodos(line.id)}
        aria-label={labels.linkTodosFor(line.title)}
        className={QUIET_ACTION}
      >
        <Link2 size={13} aria-hidden="true" className="shrink-0" />
        {labels.linkTodos}
      </button>
    </li>
  );
}

function AddWeekGoal({
  labels,
  writing,
  onCreateWeekGoal,
}: {
  labels: MorningGoalsLabels;
  writing: boolean;
  onCreateWeekGoal: (title: string) => Promise<boolean>;
}): React.JSX.Element {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  // Someone else's write: greyed, not spinning (#1804 — busy ≠ disabled).
  const waiting = writing && !busy;

  const submit = (): void => {
    const title = draft.trim();
    if (!title || busy || waiting) return;
    setBusy(true);
    void onCreateWeekGoal(title).then((ok) => {
      setBusy(false);
      // A failed write keeps the words: they are the user's only copy.
      if (ok) setDraft("");
    });
  };

  return (
    <div className="mt-2 flex items-center gap-2">
      <Input
        className="max-md:min-h-11"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (isImeComposing(e)) return;
          if (e.key === "Enter") submit();
        }}
        placeholder={labels.addPlaceholder}
        aria-label={labels.addLabel}
      />
      <Button
        size="sm"
        variant="secondary"
        onClick={submit}
        disabled={!draft.trim() || waiting}
        busy={busy}
        busyLabel={labels.adding}
        className="shrink-0 whitespace-nowrap max-md:min-h-11"
      >
        {labels.add}
      </Button>
    </div>
  );
}

export function MorningGoalsPanel({
  goals,
  labels,
  onLinkTodos,
  onSelectGoal,
  onCreateWeekGoal,
  writing = false,
  onOpenGoals,
  review,
}: MorningGoalsPanelProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-5">
      {review}
      {KINDS.map((kind) => {
        const lines = goals[kind];
        return (
          <section key={kind} aria-label={labels.periods[kind]}>
            <h3 className={cn(BRIEFING_HINT_CLASS, "mb-1")}>
              {labels.periods[kind]}
            </h3>
            {lines.length === 0 ? (
              <p className="py-1 text-sm text-lumen-text-secondary">
                {kind === "week" ? labels.prompt : labels.unset}
              </p>
            ) : (
              <ul className="divide-y divide-lumen-border">
                {lines.map((line) => (
                  <GoalRow
                    key={line.id}
                    line={line}
                    labels={labels}
                    onLinkTodos={onLinkTodos}
                    onSelectGoal={onSelectGoal}
                  />
                ))}
              </ul>
            )}
            {kind === "week" &&
              (lines.length >= GOALS_PER_PERIOD_LIMIT ? (
                <p className="mt-2 text-xs text-lumen-text-tertiary">
                  {labels.limit}
                </p>
              ) : (
                <AddWeekGoal
                  labels={labels}
                  writing={writing}
                  onCreateWeekGoal={onCreateWeekGoal}
                />
              ))}
          </section>
        );
      })}
      {onOpenGoals && (
        <div className="flex justify-end">
          <button type="button" onClick={onOpenGoals} className={QUIET_ACTION}>
            <ArrowUpRight size={13} aria-hidden="true" className="shrink-0" />
            {labels.openInConnect}
          </button>
        </div>
      )}
    </div>
  );
}
