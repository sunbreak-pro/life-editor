import type { ReactNode } from "react";
import { cn } from "../cn";

/*
 * Analytics ChartCard (design-analytics-v2). The single surface every chart /
 * aggregate sits on so the dashboard reads as one system instead of the old
 * "some carded, some bare on the page" mix. Opaque bg-secondary face + border +
 * 12px radius (§3.5 / §5 — no transparency, no backdrop-blur), a title row with
 * an optional right-aligned meta text and/or control slot (e.g. the period
 * pills), and an optional legend slot below the header. Pure presentation:
 * strings arrive already-translated (§6.4), lumen-* tokens only (§5).
 */
export interface ChartCardProps {
  /** Already-translated card title (§6.4). */
  title: string;
  /** Optional right-aligned secondary text (e.g. "直近 14 日"). */
  meta?: ReactNode;
  /** Optional right-aligned control (e.g. the day/week/month period pills). */
  control?: ReactNode;
  /** Optional legend row rendered under the header. */
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  meta,
  control,
  legend,
  children,
  className,
}: ChartCardProps): React.JSX.Element {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-lumen-text">{title}</h3>
        {(meta != null || control != null) && (
          <div className="flex flex-shrink-0 items-center gap-2">
            {meta != null && (
              <span className="text-xs text-lumen-text-tertiary">{meta}</span>
            )}
            {control}
          </div>
        )}
      </div>
      {legend != null && <div>{legend}</div>}
      {children}
    </section>
  );
}
