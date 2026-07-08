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
  /** row = dots + label side by side (Desktop card); stack = label below (Mobile). */
  orientation?: "row" | "stack";
}

export function SessionDots({
  total,
  filled,
  label,
  orientation = "row",
}: SessionDotsProps) {
  const safeTotal = Math.max(0, Math.floor(total));
  const safeFilled = Math.max(0, Math.min(safeTotal, Math.floor(filled)));

  const dots = (
    <div className={cn("flex items-center", orientation === "row" ? "gap-1.5" : "gap-2")}>
      {Array.from({ length: safeTotal }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            i < safeFilled
              ? "bg-lumen-accent"
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
          : "flex-col items-center gap-2",
      )}
    >
      {dots}
      <span className="text-[13px] text-lumen-text-secondary">{label}</span>
    </div>
  );
}
