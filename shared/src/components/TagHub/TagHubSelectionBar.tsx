import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
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
 * The bulk bar (#1644 / D10), docked to the bottom edge of the items pane
 * while at least one row is checked: "N selected" on the left, then add a tag
 * (primary), remove this tag, move to another tag, and clear.
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
 * count and every button keep their content width and refuse to wrap — and the
 * row scrolls sideways if even that does not fit. A label the user cannot read
 * is worse than one they have to scroll to.
 *
 * Esc clears the selection. The listener is on the document (the focus can be
 * anywhere in the pane while rows are checked) and skips an Esc something else
 * already handled — the tag chooser stops its own, so closing the chooser does
 * not also drop the checked rows.
 *
 * Desktop only (the Mobile brief drops bulk selection). Opaque surface (§5),
 * lumen-* tokens only, copy injected (§6.4).
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
}

type Chooser = "assign" | "move" | null;

/** #1732 — a bar button keeps its label on one line and its content width. */
const NO_SHRINK = "shrink-0 whitespace-nowrap";

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

  return (
    <div
      role="toolbar"
      aria-label={labels.region}
      className={cn(
        "flex h-12 flex-shrink-0 items-center gap-2 border-t border-lumen-border",
        // `overflow-x-auto` is the last resort under the no-shrink rule above:
        // past a certain width something has to give, and a scroll keeps every
        // label whole where clipping would not.
        "overflow-x-auto bg-lumen-bg-secondary px-3 shadow-lumen-sm",
      )}
    >
      <span
        aria-live="polite"
        className="shrink-0 whitespace-nowrap text-sm font-medium text-lumen-text"
      >
        {formatSelected(count)}
      </span>
      {/* Pushes the actions to the right without being a shrink target. */}
      <span aria-hidden className="min-w-0 flex-1" />

      <div className="relative shrink-0">
        <Button
          ref={assignRef}
          variant="primary"
          size="sm"
          className={cn(CARD_BTN_TAP, NO_SHRINK)}
          disabled={busy}
          aria-haspopup="dialog"
          aria-expanded={chooser === "assign"}
          onClick={() => toggle("assign")}
        >
          {labels.assign}
          <ChevronDown size={13} aria-hidden className="ml-1" />
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

      {canRemove && (
        <>
          <Button
            variant="secondary"
            size="sm"
            className={cn(CARD_BTN_TAP, NO_SHRINK)}
            disabled={busy}
            onClick={onRemove}
          >
            {labels.remove}
          </Button>
          <div className="relative shrink-0">
            <Button
              ref={moveRef}
              variant="secondary"
              size="sm"
              className={cn(CARD_BTN_TAP, NO_SHRINK)}
              disabled={busy}
              aria-haspopup="dialog"
              aria-expanded={chooser === "move"}
              onClick={() => toggle("move")}
            >
              {labels.move}
              <ChevronDown size={13} aria-hidden className="ml-1" />
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
        </>
      )}

      <Button
        variant="ghost"
        size="sm"
        className={cn(CARD_BTN_TAP, NO_SHRINK)}
        onClick={onClear}
      >
        {labels.clear}
      </Button>
    </div>
  );
}
