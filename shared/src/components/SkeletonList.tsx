import { cn } from "./cn";

export interface SkeletonListProps {
  /** Number of placeholder rows. Default 3. */
  rows?: number;
  /** Row height in px. Default 36. */
  rowHeight?: number;
  /** Vertical gap between rows in px. Default 8. */
  gap?: number;
  className?: string;
}

/*
 * Same-shape loading skeleton — a stack of pulsing rounded bars, never a
 * spinner (brief §3). Decorative only, so the whole list is aria-hidden;
 * the host owns the live-region announcement if one is needed. lumen-*
 * tokens only; bg-lumen-bg-secondary reads as a placeholder in light+dark.
 */
export function SkeletonList({
  rows = 3,
  rowHeight = 36,
  gap = 8,
  className,
}: SkeletonListProps) {
  const count = Math.max(0, Math.floor(rows));
  return (
    <div
      aria-hidden="true"
      className={cn("flex flex-col", className)}
      style={{ gap }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lumen-sm bg-lumen-bg-secondary"
          style={{ height: rowHeight }}
        />
      ))}
    </div>
  );
}
