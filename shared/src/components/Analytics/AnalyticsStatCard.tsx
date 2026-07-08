import type { ReactNode } from "react";
import { cn } from "../cn";

/*
 * Analytics stat card (design-analytics-v2). Icon now sits in a tinted rounded
 * tile whose color follows a MEANING system instead of the old decorative
 * per-card off-palette Tailwind color literals:
 *   - accent  → work / time metrics
 *   - mint    → achievement / completion metrics
 *   - warning → attention / stagnation metrics
 * Opaque card face (§3.5 / §5), lumen-* tokens only (§5). The value uses
 * tabular-nums so digits stay aligned across cards.
 */
export type StatTone = "accent" | "mint" | "warning";

const TONE_TILE: Record<StatTone, string> = {
  accent: "bg-lumen-accent-subtle text-lumen-accent",
  mint: "bg-lumen-chip-mint-bg text-lumen-chip-mint-fg",
  warning: "bg-lumen-chip-progress-bg text-lumen-chip-progress-fg",
};

interface AnalyticsStatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  /** Semantic color of the icon tile (§ meaning system). */
  tone: StatTone;
  subtitle?: string;
}

export function AnalyticsStatCard({
  icon,
  label,
  value,
  tone,
  subtitle,
}: AnalyticsStatCardProps): React.JSX.Element {
  return (
    <div className="flex items-start gap-3 rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary p-4">
      <span
        className={cn(
          "grid h-[34px] w-[34px] flex-shrink-0 place-items-center rounded-lumen-md",
          TONE_TILE[tone],
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-2xl font-semibold tabular-nums text-lumen-text">
          {value}
        </p>
        <p className="truncate text-xs text-lumen-text-secondary">{label}</p>
        {subtitle && (
          <p className="truncate text-xs text-lumen-text-tertiary">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
