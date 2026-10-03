import { cn } from "./cn";

/*
 * Session-progress dots for the Work / Pomodoro timer (target-IA import).
 * Pure primitive — lumen-* tokens only (§6.4). Renders `total` 10px circles;
 * the first `filled` are solid accent (phase-INDEPENDENT — always accent per
 * design 307-312), the rest are hollow (border-strong ring). An optional
 * already-translated `label` sits beside (row) or below (stack) the dots.
 */

export interface SessionDotsProps {
  /** Total dots to render (= sessionsBeforeLongBreak). */
  total: number;
  /** How many leading dots are filled (clamped to [0, total]). */
  filled: number;
  /** Already-translated progress label (e.g. "今日 2 / 4 セッション"). */
  label?: string;
  /**
   * row = dots + label side by side (Desktop card); stack = label below;
   * inline = the Mobile face's one compact line, smaller dots and a smaller
   * label (#2054, plan A merges the two lines into one).
   */
  orientation?: "row" | "stack" | "inline";
}

export function SessionDots({
  total,
  filled,
  label,
  orientation = "row",
}: SessionDotsProps) {
  const safeTotal = Math.max(0, Math.floor(total));
  const safeFilled = Math.max(0, Math.min(safeTotal, Math.floor(filled)));
  const inline = orientation === "inline";

  const dots = (
    <div
      className={cn(
        "flex items-center",
        orientation === "stack" ? "gap-2" : "gap-1.5",
      )}
    >
      {Array.from({ length: safeTotal }, (_, i) => (
        <span
          key={i}
          className={cn(
            "rounded-full",
            inline ? "h-2 w-2" : "h-2.5 w-2.5",
            i < safeFilled
              ? "bg-lumen-accent"
              : inline
                ? "border-[1.5px] border-lumen-border-strong"
                : "border-2 border-lumen-border-strong",
          )}
        />
      ))}
    </div>
  );

  if (!label) return dots;

  return (
    <div
      className={cn(
        "flex",
        orientation === "row"
          ? "items-center gap-3.5"
          : inline
            ? "items-center gap-2"
            : "flex-col items-center gap-2",
      )}
    >
      {dots}
      <span
        className={cn(
          "text-lumen-text-secondary",
          inline ? "text-xs" : "text-sm",
        )}
      >
        {label}
      </span>
    </div>
  );
}
