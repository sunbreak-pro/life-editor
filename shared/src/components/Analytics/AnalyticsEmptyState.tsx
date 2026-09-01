import type { ReactNode } from "react";
import { cn } from "../cn";

/*
 * Analytics empty state (design-analytics-v2). Replaces the old one-line "no
 * data" text with a designed empty: a rounded accent-subtle icon badge, a
 * heading, and a guidance sentence that points at the next action (start a
 * timer / add an event). Pure presentation: copy arrives already-translated
 * (§6.4), lumen-* tokens only (§5).
 *
 * Named for its feature, not its role (#1389). The brief-standard
 * `components/EmptyState.tsx` owns the bare name and a DIFFERENT contract
 * ({icon?, message, cta?} vs the {icon, title, description} here), and
 * `components/index.ts` re-exports this whole sub-barrel with `export *` —
 * so the day this one is exported under `EmptyState` the two collide in the
 * barrel and a host silently gets the other component's props.
 */
export interface AnalyticsEmptyStateProps {
  icon: ReactNode;
  /** Already-translated heading (§6.4). */
  title: string;
  /** Already-translated guidance sentence (§6.4). */
  description: string;
  className?: string;
}

export function AnalyticsEmptyState({
  icon,
  title,
  description,
  className,
}: AnalyticsEmptyStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="mb-2 grid h-14 w-14 place-items-center rounded-lumen-full bg-lumen-accent-subtle text-lumen-accent">
        {icon}
      </span>
      <span className="text-base font-semibold text-lumen-text">{title}</span>
      <span className="max-w-[420px] text-sm leading-relaxed text-lumen-text-secondary">
        {description}
      </span>
    </div>
  );
}
