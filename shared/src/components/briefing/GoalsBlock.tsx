import { BRIEFING_HINT_CLASS } from "./briefingStyles";
import { IntentionField } from "./IntentionField";
import { GOAL_PERIODS, type GoalPeriod } from "./goalSections";

/*
 * 週 / 月 / 年の目標 block (#872) — the paper's standing goals, right under
 * today's declaration so the page reads today → week → month → year.
 *
 * Three <IntentionField>s, not a new input: writing a goal is the same gesture
 * as writing the declaration (a plain-line surface saved on a debounce), and a
 * second input with its own look would say they are different acts.
 *
 * Pure presentation (§6.4): no DataService, no useTranslation — every label,
 * including the period ranges (goalPeriods.ts), is resolved by the host.
 */

/** Copy of one goal field. `range` is the host-formatted period label. */
export interface GoalFieldLabels {
  title: string;
  range: string;
  placeholder: string;
}

export type GoalsBlockLabels = Record<GoalPeriod, GoalFieldLabels>;

export interface GoalsBlockProps {
  /** Current text per period (draft ?? stored — the host owns that choice). */
  values: Record<GoalPeriod, string>;
  labels: GoalsBlockLabels;
  /** Every keystroke — the host owns draft state + debounced persistence. */
  onChange: (period: GoalPeriod, text: string) => void;
  /** Blur — the host flushes a pending debounced save. */
  onBlur: () => void;
}

export function GoalsBlock({
  values,
  labels,
  onChange,
  onBlur,
}: GoalsBlockProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      {GOAL_PERIODS.map((period) => (
        <div key={period}>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            {/* The heading IS the field's accessible name (three lookalike
                textareas — the placeholder cannot carry that job). */}
            <h4
              id={`briefing-goal-${period}`}
              className="text-xs font-bold tracking-[0.2em] text-lumen-text-secondary"
            >
              {labels[period].title}
            </h4>
            <span className={BRIEFING_HINT_CLASS}>{labels[period].range}</span>
          </div>
          <IntentionField
            value={values[period]}
            placeholder={labels[period].placeholder}
            onChange={(text) => onChange(period, text)}
            onBlur={onBlur}
            labelledBy={`briefing-goal-${period}`}
          />
        </div>
      ))}
    </div>
  );
}
