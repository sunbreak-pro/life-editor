import { X } from "lucide-react";

/*
 * TagPill — presentational pill for displaying a single tag (DU-F Step 6).
 *
 * Color handling: each tag carries an optional hex color (`color`). When
 * present we render a tinted background + matching border; when absent we
 * fall back to `ink-bg-secondary` (neutral pill). The text color stays
 * ink-text — Tailwind's content tokens already meet contrast against
 * both light and dark surfaces.
 *
 * The remove handler is optional so the pill is reusable in read-only
 * surfaces (row-end summary) and in the editable TagPicker (with X).
 */
interface TagPillProps {
  name: string;
  color: string | null;
  onRemove?: () => void;
  size?: "sm" | "md";
}

export function TagPill({ name, color, onRemove, size = "sm" }: TagPillProps) {
  const padding = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1";
  const fontSize = size === "sm" ? "text-xs" : "text-sm";
  const iconSize = size === "sm" ? 10 : 12;

  const style = color
    ? {
        backgroundColor: `${color}22`,
        borderColor: `${color}66`,
      }
    : undefined;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border ${padding} ${fontSize} text-ink-text ${
        color ? "" : "border-ink-border bg-ink-bg-secondary"
      }`}
      style={style}
    >
      {color && (
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      <span>{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${name}`}
          className="text-ink-text-secondary hover:text-ink-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink-accent rounded"
        >
          <X size={iconSize} aria-hidden />
        </button>
      )}
    </span>
  );
}
