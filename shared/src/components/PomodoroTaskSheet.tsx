import { Check, X } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import type { TaskOption } from "./PomodoroTaskSelector";
import { cn } from "./cn";

/*
 * Mobile task picker for the Work tab (target-IA import). The fullscreen timer
 * face has no room for an inline dropdown, so tapping the task chip opens this
 * BottomSheet with the candidate list + a "clear selection" row. Pure
 * primitive: host supplies tasks + selection + copy (§6.4). Selecting a task
 * (or clearing) closes the sheet via the host's onSelect + onClose.
 */

export interface PomodoroTaskSheetLabels {
  title: string;
  /** Row that clears the current attribution. */
  clearSelection: string;
  /** Shown when there are no candidate tasks. */
  emptyHint: string;
}

export interface PomodoroTaskSheetProps {
  open: boolean;
  onClose: () => void;
  tasks: readonly TaskOption[];
  selectedId: string | null;
  labels: PomodoroTaskSheetLabels;
  onSelect: (task: TaskOption | null) => void;
}

export function PomodoroTaskSheet({
  open,
  onClose,
  tasks,
  selectedId,
  labels,
  onSelect,
}: PomodoroTaskSheetProps) {
  const choose = (task: TaskOption | null) => {
    onSelect(task);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={labels.title}>
      {tasks.length === 0 ? (
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
          {tasks.map((t) => {
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
                  <span className="flex w-4 shrink-0 justify-center" aria-hidden="true">
                    {active ? <Check size={16} /> : null}
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
