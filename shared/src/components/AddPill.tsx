import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "./cn";
import { FOCUS_RING_TIGHT } from "./styleTokens";
import { tourAnchor } from "./tour/anchor";

/**
 * The accent "+ 追加" pill that starts a create flow from a list header (#302).
 *
 * It shipped as an inline `<button>` in Materials and was copied verbatim to a
 * second surface, so the recipe existed as two byte-identical 6-token class
 * strings with only the label key differing. #1034 needed a third host —
 * narrow Schedule, replacing its floating "+" — which is the point at which a
 * copy becomes a definition.
 *
 * Hosts today: `web/src/notes/NotesView.tsx` (「+ノート」),
 * `web/src/schedule/CalendarNarrowLayout.tsx` (「+追加」, narrow only),
 * `web/src/schedule/ScheduleSidebar.tsx` (「+Todo」 — inherited from the
 * Kanban board's toolbar when #1153 retired it).
 *
 * The host keeps the row: this part is the button and nothing else, because
 * the three placements differ (right-aligned in a padded strip, in a toolbar's
 * action group, opposite a day caption). Wrapping the alignment in here would
 * make every host fight it with `className`, and `cn` is a plain joiner — the
 * loser of two competing utilities is decided by CSS source order, not by
 * argument order (see `cn.ts`).
 *
 * Focus ring: `FOCUS_RING_TIGHT`, which is byte-identical to what the two
 * Materials copies already carry. #880 argues accent-FILLED controls want
 * `FOCUS_RING_ON_ACCENT` instead — that is very likely right for this pill
 * too, but changing it here would silently restyle Materials, so it stays a
 * separate call.
 */
const PILL =
  "inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-lumen-accent px-3.5 py-1.5 " +
  "text-[0.8125rem] font-medium text-lumen-on-accent shadow-lumen-sm transition-opacity hover:opacity-90";

export interface AddPillProps {
  onClick: () => void;
  /**
   * Already-translated label. Shared components never call `useTranslation`
   * themselves (rules/frontend.md §デザイン規約).
   */
  label: string;
  /** Glyph override. Defaults to the 14px plus every current host wants. */
  icon?: ReactNode;
  /**
   * `data-tour-id` for the tutorial tour (#1124). A prop rather than a fixed
   * value because this pill has three hosts and the tour points at two of
   * them for different reasons — a hardcoded id would make whichever host
   * rendered first answer for all of them.
   */
  tourId?: string;
  className?: string;
}

export function AddPill({
  onClick,
  label,
  icon,
  tourId,
  className,
}: AddPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...(tourId ? tourAnchor(tourId) : {})}
      className={cn(PILL, FOCUS_RING_TIGHT, className)}
    >
      {icon ?? <Plus size={14} aria-hidden />}
      {label}
    </button>
  );
}
