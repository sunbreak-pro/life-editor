import { X } from "lucide-react";
import { cn } from "./cn";
import { TagHeadingIcon } from "./TagHeadingIcon";

/*
 * TagPill — the shared chip for one tag (DU-F Step 6; moved out of
 * web/src/wikitag into the parts layer by #1291).
 *
 * WHY it moved: it is the only chip the app draws for a tag, and #1291 asked
 * for a tag's icon to appear everywhere its NAME appears. A chip that lives in
 * the web host cannot be the answer to "everywhere" — shared/src/components is
 * where cross-host UI belongs (CLAUDE.md §6), and it is what the notes filter
 * surface (#1288, rebuilding in its own lane) can adopt without reaching into
 * another host's folder.
 *
 * Leading glyph: the tag's own icon, resolved by <TagHeadingIcon> — the same
 * one read path the tag headings, the master list and the Tag hub use, so
 * editing an icon moves every surface at once (#1291 DoD). It REPLACES the
 * colour dot this chip used to draw: the glyph is already tinted with the tag
 * colour, so keeping both said the same thing twice, and a tag with no icon
 * still gets the generic Tag glyph rather than nothing — the same fallback the
 * master list has always shown.
 *
 * Colour handling: each tag carries an optional hex color (`color`). When
 * present we render a tinted background + matching border; when absent we fall
 * back to `lumen-bg-secondary` (neutral pill). The text color stays lumen-text
 * — Tailwind's content tokens already meet contrast against both light and
 * dark surfaces.
 *
 * The remove handler is optional so the pill is reusable in read-only surfaces
 * (row-end summary) and in the editable TagPicker (with X).
 */
export interface TagPillProps {
  name: string;
  color: string | null;
  /** Stored lucide icon name from `wiki_tags.icon`; null → the generic glyph. */
  icon?: string | null;
  onRemove?: () => void;
  /** Already-translated aria-label for the remove button (#412). */
  removeLabel?: string;
  size?: "sm" | "md";
}

export function TagPill({
  name,
  color,
  icon = null,
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
  // One step under the remove X so the glyph reads as part of the label rather
  // than as a second control.
  const glyphSize = size === "sm" ? 12 : 14;

  const style = color
    ? {
        backgroundColor: `${color}22`,
        borderColor: `${color}66`,
      }
    : undefined;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border",
        padding,
        fontSize,
        "text-lumen-text",
        color ? null : "border-lumen-border bg-lumen-bg-secondary",
      )}
      style={style}
    >
      <TagHeadingIcon icon={icon} color={color} size={glyphSize} />
      <span>{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? `Remove tag ${name}`}
          className="rounded-lumen-sm text-lumen-text-secondary hover:text-lumen-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lumen-accent"
        >
          <X size={iconSize} aria-hidden />
        </button>
      )}
    </span>
  );
}
