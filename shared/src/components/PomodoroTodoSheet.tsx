import { Check, X } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { workTargetIcon, type WorkTargetOption } from "./PomodoroTodoSelector";
import { cn } from "./cn";

/*
 * Mobile work-target picker for the Work tab (target-IA import). The fullscreen
 * timer face has no room for an inline dropdown, so tapping the chip opens this
 * BottomSheet with the candidate list + a "clear selection" row. Pure
 * primitive: host supplies the items + selection + copy (§6.4). Selecting one
 * (or clearing) closes the sheet via the host's onSelect + onClose.
 *
 * Todos and Events share one list, for the reason spelled out on the selector.
 * The kind rides on the leading glyph — the check mark that marks the CURRENT
 * selection keeps its own column so the two never contend for the same slot.
 */

export interface PomodoroTodoSheetLabels {
  title: string;
  /** Name for the sheet's close button (#525). */
  close: string;
  /** Row that clears the current attribution. */
  clearSelection: string;
  /** Shown when there are no candidates at all. */
  emptyHint: string;
}

export interface PomodoroTodoSheetProps {
  open: boolean;
  onClose: () => void;
  items: readonly WorkTargetOption[];
  selectedId: string | null;
  labels: PomodoroTodoSheetLabels;
  onSelect: (item: WorkTargetOption | null) => void;
}

export function PomodoroTodoSheet({
  open,
  onClose,
  items,
  selectedId,
  labels,
  onSelect,
}: PomodoroTodoSheetProps) {
  const choose = (item: WorkTargetOption | null) => {
    onSelect(item);
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={labels.title}
      closeLabel={labels.close}
    >
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-lumen-text-tertiary">
          {labels.emptyHint}
        </p>
      ) : (
        <ul className="flex max-h-[50vh] flex-col overflow-y-auto">
          <li>
            <button
              type="button"
              onClick={() => choose(null)}
              className="flex w-full items-center gap-3 rounded-lumen-md px-3 py-3 text-left text-sm text-lumen-text-secondary hover:bg-lumen-hover"
            >
              <X size={16} aria-hidden="true" className="shrink-0" />
              {labels.clearSelection}
            </button>
          </li>
          {items.map((t) => {
            const active = t.id === selectedId;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => choose(t)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lumen-md px-3 py-3 text-left text-sm hover:bg-lumen-hover",
                    active
                      ? "font-semibold text-lumen-accent"
                      : "text-lumen-text",
                  )}
                >
                  <span
                    className="flex w-4 shrink-0 justify-center"
                    aria-hidden="true"
                  >
                    {active ? <Check size={16} /> : null}
                  </span>
                  <span className="shrink-0 text-lumen-text-tertiary">
                    {workTargetIcon(t.kind, 16)}
                  </span>
                  <span className="truncate">{t.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
}
