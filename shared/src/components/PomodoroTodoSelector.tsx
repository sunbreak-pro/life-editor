import { useState } from "react";
import { X, ChevronDown, CalendarDays, CheckSquare } from "lucide-react";
import { Card } from "./Card";
import { Menu, MenuItem } from "./Menu";
import { cn } from "./cn";

/*
 * Work-target attribution selector for the Work tab (target-IA import). A
 * Pomodoro session can be linked to a Todo (`task_id`) or, since #1375, to an
 * Event (`event_id`) on timer_sessions. Pure primitive: the host supplies the
 * candidates + selection state + copy (§6.4).
 *
 * ONE flat list, not two pickers. "What am I working on right now" is a single
 * question, and splitting it in two would make the user answer "which kind is
 * it" before they can answer it. The kind still has to be visible — the id
 * alone does not say which column the row is written to — so it rides along as
 * a leading icon and, once picked, as the chip's colour family (chip-task blue
 * vs chip-event purple, the same pairing the calendar already uses).
 *
 * States (design 321-324 / 1053-1059 / loading skeleton):
 *  - selected   → a chip in the kind's colours with a clear (X) button
 *  - unselected → a trigger button that opens a lumen <Menu> dropdown (native
 *                 <select> retired). ChevronDown affordance.
 *  - no items   → the trigger is disabled/dimmed + a hint row explains why
 *  - loading    → skeleton bars (surface-sunken) while the host fetches
 */

export interface WorkTargetOption {
  id: string;
  title: string;
  /** Which column a session started against this option writes to (#1375). */
  kind: "todo" | "event";
}

/** Leading glyph per kind — the only thing that says which list a row is in. */
export function workTargetIcon(kind: WorkTargetOption["kind"], size = 15) {
  return kind === "event" ? (
    <CalendarDays size={size} aria-hidden="true" />
  ) : (
    <CheckSquare size={size} aria-hidden="true" />
  );
}

/** Chip colours per kind. Events borrow the calendar's purple family. */
export function workTargetChipClass(kind: WorkTargetOption["kind"]): string {
  return kind === "event"
    ? "bg-lumen-chip-event-bg text-lumen-chip-event-fg"
    : "bg-lumen-chip-task-bg text-lumen-chip-task-fg";
}

export interface PomodoroTodoSelectorLabels {
  heading: string;
  placeholder: string;
  clear: string;
  /** Hint shown when there are no candidates at all. */
  emptyHint: string;
  /** a11y label for the dropdown menu. */
  menuLabel: string;
}

export interface PomodoroTodoSelectorProps {
  items: readonly WorkTargetOption[];
  selectedId: string | null;
  /** While true, show skeletons instead of the trigger (host is fetching). */
  loading?: boolean;
  labels: PomodoroTodoSelectorLabels;
  onSelect: (item: WorkTargetOption | null) => void;
}

export function PomodoroTodoSelector({
  items,
  selectedId,
  loading = false,
  labels,
  onSelect,
}: PomodoroTodoSelectorProps) {
  const [open, setOpen] = useState(false);
  const selected = items.find((t) => t.id === selectedId) ?? null;
  const hasItems = items.length > 0;

  return (
    <Card padding="none" className="flex flex-col gap-2 px-5 py-4">
      <div className="flex items-center gap-4">
        <span className="shrink-0 text-sm font-semibold text-lumen-text-secondary">
          {labels.heading}
        </span>

        {loading ? (
          <div className="h-[38px] w-full max-w-[360px] animate-pulse rounded-lumen-md bg-lumen-surface-sunken" />
        ) : selected ? (
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-lumen-md py-1.5 pl-3 pr-2 text-sm font-medium",
              workTargetChipClass(selected.kind),
            )}
          >
            <span className="shrink-0">{workTargetIcon(selected.kind, 14)}</span>
            <span className="truncate">{selected.title}</span>
            <button
              type="button"
              aria-label={labels.clear}
              onClick={() => onSelect(null)}
              className="inline-flex shrink-0 items-center justify-center rounded p-0.5 hover:opacity-70"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        ) : (
          <div className="relative w-full max-w-[360px]">
            <button
              type="button"
              disabled={!hasItems}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => hasItems && setOpen((v) => !v)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lumen-md border border-lumen-border-strong bg-lumen-bg px-3 py-[9px] text-sm text-lumen-text-secondary",
                "hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                !hasItems && "cursor-not-allowed opacity-55 hover:bg-lumen-bg",
              )}
            >
              <span className="truncate">{labels.placeholder}</span>
              <ChevronDown size={15} aria-hidden="true" className="shrink-0" />
            </button>
            <Menu
              open={open}
              onClose={() => setOpen(false)}
              label={labels.menuLabel}
              className="max-h-64 w-full overflow-y-auto"
            >
              {items.map((t) => (
                <MenuItem
                  key={t.id}
                  icon={workTargetIcon(t.kind)}
                  onSelect={() => {
                    onSelect(t);
                    setOpen(false);
                  }}
                >
                  {t.title}
                </MenuItem>
              ))}
            </Menu>
          </div>
        )}
      </div>

      {!loading && !hasItems && !selected ? (
        <p className="pl-[88px] text-xs text-lumen-text-tertiary">
          {labels.emptyHint}
        </p>
      ) : null}
    </Card>
  );
}
