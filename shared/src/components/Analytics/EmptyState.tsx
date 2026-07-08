import type { ReactNode } from "react";
import { cn } from "../cn";

/*
 * Analytics EmptyState (design-analytics-v2). Replaces the old one-line "no
 * data" text with a designed empty: a rounded accent-subtle icon badge, a
 * heading, and a guidance sentence that points at the next action (start a
 * timer / add an event). Pure presentation: copy arrives already-translated
 * (§6.4), lumen-* tokens only (§5).
 */
export interface EmptyStateProps {
  icon: ReactNode;
  /** Already-translated heading (§6.4). */
  title: string;
  /** Already-translated guidance sentence (§6.4). */
  description: string;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  className,
}: EmptyStateProps): React.JSX.Element {
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
