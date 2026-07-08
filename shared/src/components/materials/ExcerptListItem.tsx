import type { ReactNode } from "react";
import { cn } from "../cn";

export interface ExcerptListItemProps {
  /** Already-translated title (14px semibold, truncated). */
  title: string;
  /** Optional one-line excerpt (12px secondary, ellipsis). Omit for a 1-row item. */
  excerpt?: string;
  /** Marks the row as the current selection (accent border + hover fill). */
  selected?: boolean;
  /** Leading glyph (e.g. a note / status icon). */
  leading?: ReactNode;
  /** Trailing node on the title row (pin / lock indicator, etc.). */
  meta?: ReactNode;
  /** When provided the row is a full-width button; otherwise a static div. */
  onClick?: () => void;
  className?: string;
}

/*
 * Title + one-line-excerpt list row (Notes Mobile / Daily past entries). The
 * card surface is bg-lumen-bg-secondary + border; the selected row lifts to
 * accent border + hover fill. Clickable rows render as a full-width, left-
 * aligned <button> (keyboard reachable) and expose aria-current; read-only
 * rows are a plain div. Pure presentation: copy injected (§6.4), lumen-*
 * tokens only (§5).
 */
export function ExcerptListItem({
  title,
  excerpt,
  selected = false,
  leading,
  meta,
  onClick,
  className,
}: ExcerptListItemProps) {
  const containerClass = cn(
    "flex w-full items-start gap-2.5 rounded-lumen-md border px-3 py-2 text-left",
    "transition-colors",
    selected
      ? "border-lumen-accent bg-lumen-hover"
      : "border-lumen-border bg-lumen-bg-secondary",
    onClick &&
      "hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
    className,
  );

  const inner = (
    <>
      {leading != null && (
        <span
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-lumen-text-tertiary"
        >
          {leading}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-lumen-text">
            {title}
          </span>
          {meta != null && <span className="shrink-0">{meta}</span>}
        </div>
        {excerpt != null && excerpt !== "" && (
          <p className="mt-0.5 truncate text-xs text-lumen-text-secondary">
            {excerpt}
          </p>
        )}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-current={selected || undefined}
        className={containerClass}
      >
        {inner}
      </button>
    );
  }
  return <div className={containerClass}>{inner}</div>;
}
