import { X } from "lucide-react";

/*
 * TagPill — presentational pill for displaying a single tag (DU-F Step 6).
 *
 * Color handling: each tag carries an optional hex color (`color`). When
 * present we render a tinted background + matching border; when absent we
 * fall back to `lumen-bg-secondary` (neutral pill). The text color stays
 * lumen-text — Tailwind's content tokens already meet contrast against
 * both light and dark surfaces.
 *
 * The remove handler is optional so the pill is reusable in read-only
 * surfaces (row-end summary) and in the editable TagPicker (with X).
 */
interface TagPillProps {
  name: string;
  color: string | null;
  onRemove?: () => void;
  /** Already-translated aria-label for the remove button (#412). */
  removeLabel?: string;
  size?: "sm" | "md";
}

export function TagPill({
  name,
  color,
  onRemove,
  removeLabel,
  size = "sm",
}: TagPillProps) {
  // Horizontal padding only — the pill's HEIGHT now comes from the remove
  // button's hit-area floor (styles/tokens.css), so a py-* here would just
  // fight it. Pills without a remove button keep their own vertical padding.
  const padding = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";
  const fontSize = size === "sm" ? "text-xs" : "text-sm";
  const iconSize = size === "sm" ? 14 : 16;

  const style = color
    ? {
        backgroundColor: `${color}22`,
        borderColor: `${color}66`,
      }
    : undefined;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border ${padding} ${fontSize} text-lumen-text ${
        color ? "" : "border-lumen-border bg-lumen-bg-secondary"
      }`}
      style={style}
    >
      {color && (
        <span
          aria-hidden
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      <span>{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? `Remove tag ${name}`}
          className="text-lumen-text-secondary hover:text-lumen-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent rounded-lumen-sm"
        >
          <X size={iconSize} aria-hidden />
        </button>
      )}
    </span>
  );
}
