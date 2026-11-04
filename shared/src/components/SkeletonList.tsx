import { cn } from "./cn";

export interface SkeletonListProps {
  /** Number of placeholder rows. Default 3. */
  rows?: number;
  /** Row height in px. Default 36. */
  rowHeight?: number;
  /** Vertical gap between rows in px. Default 8. */
  gap?: number;
  /**
   * Per-row CSS widths (e.g. `["82%", "64%"]`), repeated from the start when
   * there are more rows than entries. Omitted, every bar spans the full width.
   */
  widths?: readonly string[];
  /**
   * Already-translated accessible name (#2620). Given, the list becomes the
   * screen's loading announcement: `role="status"` + `aria-busy` + this name.
   * Omitted (or empty, so a missing translation cannot mint a nameless
   * status), the list stays decorative and the host owns the announcement.
   */
  label?: string;
  /**
   * Lands on the outermost element. With `label` that is the status wrapper,
   * and the flex column with its `gap` is the element inside it, so layout
   * classes that target the bars' column apply only without `label`.
   */
  className?: string;
}

/*
 * Same-shape loading skeleton — a stack of pulsing rounded bars, never a
 * spinner (brief §3). lumen-* tokens only; bg-lumen-bg-secondary reads as a
 * placeholder in light+dark.
 *
 * The bars themselves are always aria-hidden. `label` exists because every
 * screen that wanted its skeleton announced had hand-rolled the same
 * role="status" wrapper (TagHubTagRail, TagHubView, GoalTreeView) and one had
 * left it nameless (NotesView). The prototype's loading state, shared by the
 * schedule / materials / connect screens, is:
 *
 *   <SkeletonList
 *     rows={8}
 *     rowHeight={14}
 *     gap={12}
 *     widths={["82%", "64%", "74%", "58%"]}
 *     label={t("common.loading")}
 *   />
 *
 * Reduced motion needs nothing here: tokens.css stops animate-pulse globally.
 */
export function SkeletonList({
  rows = 3,
  rowHeight = 36,
  gap = 8,
  widths,
  label,
  className,
}: SkeletonListProps) {
  const count = Math.max(0, Math.floor(rows));
  const bars = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className="animate-pulse rounded-lumen-sm bg-lumen-bg-secondary"
      style={{
        height: rowHeight,
        width: widths?.length ? widths[i % widths.length] : undefined,
      }}
    />
  ));

  if (!label) {
    return (
      <div
        aria-hidden="true"
        className={cn("flex flex-col", className)}
        style={{ gap }}
      >
        {bars}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={className}
    >
      <div aria-hidden="true" className="flex flex-col" style={{ gap }}>
        {bars}
      </div>
    </div>
  );
}
