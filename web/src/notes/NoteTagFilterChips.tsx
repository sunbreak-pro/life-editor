import { useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn, FOCUS_RING } from "@life-editor/shared";

/*
 * The Notes tag filter row (#1288) — MULTI-select, where #369's was solo-one.
 *
 * WHY A NOTES-LOCAL COMPONENT AND NOT <StatusFilterChips>. That shared chip row
 * is a single-select control by contract (`value: string | null`, "re-click to
 * clear"), and its other caller is the Mobile Todos status filter, where
 * single-select is the correct semantics — a todo is in one status. Widening it
 * to serve two selection models would put a mode flag on a component another
 * lane owns, for a shape only this surface wants (#1288's own note: one writer
 * per artifact). The chip's LOOK is copied on purpose so the two rows still
 * read as the same control.
 *
 * OR, NOT AND (the semantics, decided here): the list this filters is GROUPED
 * BY TAG, so "selected" means "show these headings". Two tags selected shows
 * both sections. AND (only notes carrying every selected tag) cannot be drawn
 * in a tag-grouped list without inventing a heading for the intersection, and
 * the many-to-many model makes it the rarer question anyway.
 *
 * THE CAP is the other half of the Issue: with a dozen tags the row wrapped to
 * four lines inside a ~240px sidebar and pushed the first note off the fold.
 * Only the first `VISIBLE_LIMIT` chips are drawn until the user asks for the
 * rest — and selected chips are ordered first, so what is currently filtering
 * the list can never be the part that is hidden.
 *
 * Pure presentation (§6.4): copy arrives already translated, lumen-* only.
 */

export interface NoteTagFilterChip {
  id: string;
  /** Already-translated chip label (§6.4). */
  label: string;
  count: number;
  /** Leading glyph — the tag's own icon, tinted with its colour (#1365). */
  icon?: ReactNode;
}

export interface NoteTagFilterChipsLabels {
  /** Accessible name for the whole row. */
  group: string;
  /** Action label for the clear button. */
  clear: string;
  /** "+N more" — the number of chips still hidden. */
  more: (count: number) => string;
  /** Collapse back to the capped row. */
  less: string;
}

export interface NoteTagFilterChipsProps {
  chips: NoteTagFilterChip[];
  /** Selected chip ids. Empty = no filter, every group shows. */
  value: readonly string[];
  /** Add / remove one id. The host owns the set. */
  onToggle: (id: string) => void;
  /** Drop every selection at once. */
  onClear: () => void;
  labels: NoteTagFilterChipsLabels;
}

/*
 * How many chips are drawn before the row asks to be expanded.
 *
 * 6, down from #1288's 8 (#1365). The chips gained a glyph, which is what
 * makes them scannable without reading — and also what makes them wider, so
 * eight of them wrapped to four lines in a ~240px sidebar and pushed the first
 * note under the fold. Six keeps the row to about half that; the rest are one
 * press away and the "+N" says how many there are.
 */
export const VISIBLE_LIMIT = 6;

export function NoteTagFilterChips({
  chips,
  value,
  onToggle,
  onClear,
  labels,
}: NoteTagFilterChipsProps) {
  const [expanded, setExpanded] = useState(false);
  const selected = useMemo(() => new Set(value), [value]);

  // Selected first, otherwise the original (name-sorted) order. A stable sort
  // is what keeps the unselected chips from reshuffling as you pick tags —
  // only the picked one moves, to the front.
  const ordered = useMemo(() => {
    const picked = chips.filter((c) => selected.has(c.id));
    const rest = chips.filter((c) => !selected.has(c.id));
    return [...picked, ...rest];
  }, [chips, selected]);

  const hidden = Math.max(0, ordered.length - VISIBLE_LIMIT);
  const shown = expanded || hidden === 0 ? ordered : ordered.slice(0, VISIBLE_LIMIT);

  return (
    <div role="group" aria-label={labels.group} className="flex flex-wrap gap-1">
      {shown.map((chip) => {
        const active = selected.has(chip.id);
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(chip.id)}
            className={cn(
              // A ceiling per chip, not per row (#1365): `max-w-full` let one
              // long tag name take a whole line to itself while the short ones
              // that would have shared it wrapped below. The label truncates
              // inside it, and the glyph and count keep their width either way.
              "inline-flex max-w-[9.5rem] items-center gap-1 rounded-lumen-full border px-2 py-0.5 text-xs transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
              active
                ? "border-lumen-accent bg-lumen-accent-subtle font-semibold text-lumen-accent"
                : "border-lumen-border bg-lumen-bg text-lumen-text-secondary hover:bg-lumen-hover",
            )}
          >
            {chip.icon != null && (
              <span aria-hidden="true" className="inline-flex">
                {chip.icon}
              </span>
            )}
            <span className="min-w-0 truncate">{chip.label}</span>
            <span
              className={cn(
                "tabular-nums",
                active ? "text-lumen-accent" : "text-lumen-text-tertiary",
              )}
            >
              {chip.count}
            </span>
          </button>
        );
      })}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={cn(
            "inline-flex items-center rounded-lumen-full border border-dashed border-lumen-border px-2 py-0.5 text-xs text-lumen-text-tertiary hover:bg-lumen-hover",
            FOCUS_RING,
          )}
        >
          {expanded ? labels.less : labels.more(hidden)}
        </button>
      )}

      {/* Only with something to clear: an always-present control that does
          nothing most of the time is one more thing to read past. */}
      {value.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          aria-label={labels.clear}
          title={labels.clear}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-lumen-full border border-lumen-border bg-lumen-bg px-2 py-0.5 text-xs text-lumen-text-secondary hover:bg-lumen-hover",
            FOCUS_RING,
          )}
        >
          <X size={11} aria-hidden />
        </button>
      )}
    </div>
  );
}
