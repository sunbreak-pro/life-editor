import { useEffect, useRef, useState } from "react";
import { ArrowRightLeft, Tag, X } from "lucide-react";
import { Button } from "../Button";
import { cn } from "../cn";
import { CARD_BTN_TAP } from "../styleTokens";
import { isImeComposing } from "../../utils/imeGuard";
import {
  TagHubTagPickerPopover,
  type TagHubTagPickerLabels,
} from "./TagHubTagPickerPopover";
import type { TagHubTagSummary } from "./types";

/*
 * The bulk bar (#1644 / D10), up while at least one row is checked: "N
 * selected" and clear, then add a tag, move to another tag and remove this
 * tag. Where it sits is the view's (#2224): stacked in the Desktop tag rail
 * (`layout="rail"`), or a card pinned over the bottom of the Mobile list.
 *
 * The three writes carry one weight (#2601): framed, each led by its own
 * glyph. A filled "Add a tag" said that adding is what selecting is for.
 *
 * "Remove" and "move" act on the tag being READ, so they exist only while that
 * is a real tag — the untagged bucket has nothing to take off (the host passes
 * `canRemove={false}` there). Add is always on offer; on the untagged bucket
 * it is the whole point of selecting.
 *
 * IT MUST SURVIVE A NARROW COLUMN (#1732). With the right panel open the
 * items pane is 590px at 1440, and the bar broke in two different ways at
 * once: English wrapped each button's label onto a second line, which spilled
 * the text out of the 32px pill it is painted in, and Japanese kept one line
 * by truncating "2 件を選択中" down to "2 …". So nothing here shrinks — the
 * count and every button keep their content width and refuse to wrap. What
 * gives instead is the Mobile card's height (#2601): its buttons flow onto
 * further lines. It used to be one strip that scrolled sideways, and a button
 * cut in half at the screen's edge does not say there is more to scroll to.
 *
 * Esc clears the selection. The listener is on the document (the focus can be
 * anywhere in the pane while rows are checked) and skips an Esc something else
 * already handled — the tag chooser stops its own, so closing the chooser does
 * not also drop the checked rows.
 *
 * Both widths since #2224, behind the header's "Select" button. Opaque
 * surface (§5), lumen-* tokens only, copy injected (§6.4).
 */

export interface TagHubSelectionBarLabels {
  /** The toolbar's accessible name. */
  region: string;
  assign: string;
  remove: string;
  move: string;
  clear: string;
  /** Accessible names of the two choosers. */
  assignTitle: string;
  moveTitle: string;
  picker: TagHubTagPickerLabels;
}

export interface TagHubSelectionBarProps {
  count: number;
  /** "3 selected". */
  formatSelected: (count: number) => string;
  /** Every live tag, for the add chooser. */
  tags: readonly TagHubTagSummary[];
  /** The tag being read — left out of the move chooser. */
  currentTagId: string;
  /** False on the untagged bucket: no remove, no move. */
  canRemove: boolean;
  /** True while a bulk write is running — the actions are held off. */
  busy?: boolean;
  onAssign: (tagId: string) => void;
  onCreateAndAssign: (name: string) => void;
  onRemove: () => void;
  onMove: (tagId: string) => void;
  onClear: () => void;
  labels: TagHubSelectionBarLabels;
  /**
   * "row" = the Mobile card pinned over the list's bottom edge, its buttons
   * wrapping; "rail" = stacked, for the Desktop tag rail (#2224).
   */
  layout?: "row" | "rail";
}

type Chooser = "assign" | "move" | null;

/** #1732 — a bar button keeps its label on one line and its content width. */
const NO_SHRINK = "shrink-0 whitespace-nowrap";
/**
 * The writes' frame (#2601): `secondary` is the same surface the bar is
 * painted in, so without a border they read as text, not as buttons.
 */
const WRITE_BTN = cn(
  CARD_BTN_TAP,
  NO_SHRINK,
  "border border-lumen-border-strong",
);

export function TagHubSelectionBar({
  count,
  formatSelected,
  tags,
  currentTagId,
  canRemove,
  busy = false,
  onAssign,
  onCreateAndAssign,
  onRemove,
  onMove,
  onClear,
  labels,
  layout = "row",
}: TagHubSelectionBarProps) {
  const [chooser, setChooser] = useState<Chooser>(null);
  const assignRef = useRef<HTMLButtonElement | null>(null);
  const moveRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || isImeComposing(e)) return;
      onClear();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClear]);

  const toggle = (next: Exclude<Chooser, null>) =>
    setChooser((current) => (current === next ? null : next));
  const closeChooser = () => setChooser(null);
  const others = tags.filter((tag) => tag.id !== currentTagId);

  const assignButton = (
    <div className={cn("relative", layout === "rail" ? "w-full" : "shrink-0")}>
      <Button
        ref={assignRef}
        variant="secondary"
        size="sm"
        leadingIcon={<Tag size={13} aria-hidden className="shrink-0" />}
        className={cn(WRITE_BTN, layout === "rail" && "w-full")}
        disabled={busy}
        aria-haspopup="dialog"
        aria-expanded={chooser === "assign"}
        onClick={() => toggle("assign")}
      >
        {labels.assign}
      </Button>
      <TagHubTagPickerPopover
        open={chooser === "assign"}
        onClose={closeChooser}
        title={labels.assignTitle}
        tags={tags}
        onPick={onAssign}
        onCreate={onCreateAndAssign}
        anchorRef={assignRef}
        labels={labels.picker}
      />
    </div>
  );

  const removeButton = canRemove && (
    <Button
      variant="secondary"
      size="sm"
      leadingIcon={<X size={13} aria-hidden className="shrink-0" />}
      className={cn(WRITE_BTN, layout === "rail" && "w-full")}
      disabled={busy}
      onClick={onRemove}
    >
      {labels.remove}
    </Button>
  );

  const moveButton = canRemove && (
    <div className={cn("relative", layout === "rail" ? "w-full" : "shrink-0")}>
      <Button
        ref={moveRef}
        variant="secondary"
        size="sm"
        leadingIcon={
          <ArrowRightLeft size={13} aria-hidden className="shrink-0" />
        }
        className={cn(WRITE_BTN, layout === "rail" && "w-full")}
        disabled={busy}
        aria-haspopup="dialog"
        aria-expanded={chooser === "move"}
        onClick={() => toggle("move")}
      >
        {labels.move}
      </Button>
      <TagHubTagPickerPopover
        open={chooser === "move"}
        onClose={closeChooser}
        title={labels.moveTitle}
        tags={others}
        onPick={onMove}
        anchorRef={moveRef}
        labels={labels.picker}
      />
    </div>
  );

  const countText = (
    <span
      aria-live="polite"
      className="shrink-0 whitespace-nowrap text-sm font-medium text-lumen-text"
    >
      {formatSelected(count)}
    </span>
  );

  const clearButton = (
    <Button
      variant="ghost"
      size="sm"
      className={cn(CARD_BTN_TAP, NO_SHRINK)}
      onClick={onClear}
    >
      {labels.clear}
    </Button>
  );

  if (layout === "rail") {
    /*
     * #2224 — the Desktop bar lives in the tag rail, above the add row, so a
     * row checked in the items pane never moves: the pane does not gain a bar
     * under it. A 260px column has no room for a row of buttons, so the
     * count and clear share the top line and the three writes stack under it,
     * in the order the prototype gives (add, move, remove).
     */
    return (
      <div
        role="toolbar"
        aria-label={labels.region}
        aria-orientation="vertical"
        data-taghub-selection-bar="rail"
        className="flex flex-shrink-0 flex-col gap-1.5 border-t border-lumen-border bg-lumen-bg-secondary px-3 py-2.5"
      >
        <div className="flex items-center gap-2">
          {countText}
          <span aria-hidden className="min-w-0 flex-1" />
          {clearButton}
        </div>
        {assignButton}
        {moveButton}
        {removeButton}
      </div>
    );
  }

  return (
    <div
      role="toolbar"
      aria-label={labels.region}
      data-taghub-selection-bar="row"
      // TagHubItemGroups leaves the room under its last row for this card at
      // its tallest, so a taller card means more room there (#2601).
      className="m-2 flex flex-shrink-0 flex-col gap-2 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary px-3 py-2 shadow-lumen-md"
    >
      <div className="flex items-center gap-2">
        {countText}
        <span aria-hidden className="min-w-0 flex-1" />
        {clearButton}
      </div>
      <div data-taghub-selection-actions="" className="flex flex-wrap gap-2">
        {assignButton}
        {moveButton}
        {removeButton}
      </div>
    </div>
  );
}
