import { useState } from "react";
import { X, ChevronDown } from "lucide-react";
import { Card } from "./Card";
import { Menu, MenuItem } from "./Menu";
import { cn } from "./cn";

/*
 * Todo attribution selector for the Work tab (target-IA import). Pomodoro
 * sessions can be linked to a todo (task_id on timer_sessions). Pure primitive:
 * the host supplies the candidate todos + selection state + copy (§6.4).
 *
 * States (design 321-324 / 1053-1059 / loading skeleton):
 *  - selected   → a todo chip (chip-todo tokens) with a clear (X) button
 *  - unselected → a trigger button that opens a lumen <Menu> dropdown (native
 *                 <select> retired). ChevronDown affordance.
 *  - no todos   → the trigger is disabled/dimmed + a hint row explains why
 *  - loading    → skeleton bars (surface-sunken) while the host fetches todos
 */

export interface TodoOption {
  id: string;
  title: string;
}

export interface PomodoroTodoSelectorLabels {
  heading: string;
  placeholder: string;
  clear: string;
  /** Hint shown when there are no candidate todos. */
  emptyHint: string;
  /** a11y label for the dropdown menu. */
  menuLabel: string;
}

export interface PomodoroTodoSelectorProps {
  todos: readonly TodoOption[];
  selectedId: string | null;
  /** While true, show skeletons instead of the trigger (host is fetching). */
  loading?: boolean;
  labels: PomodoroTodoSelectorLabels;
  onSelect: (todo: TodoOption | null) => void;
}

export function PomodoroTodoSelector({
  todos,
  selectedId,
  loading = false,
  labels,
  onSelect,
}: PomodoroTodoSelectorProps) {
  const [open, setOpen] = useState(false);
  const selected = todos.find((t) => t.id === selectedId) ?? null;
  const hasTodos = todos.length > 0;

  return (
    <Card padding="none" className="flex flex-col gap-2 px-5 py-4">
      <div className="flex items-center gap-4">
        <span className="shrink-0 text-sm font-semibold text-lumen-text-secondary">
          {labels.heading}
        </span>

        {loading ? (
          <div className="h-[38px] w-full max-w-[360px] animate-pulse rounded-lumen-md bg-lumen-surface-sunken" />
        ) : selected ? (
          <span className="inline-flex items-center gap-2 rounded-lumen-md bg-lumen-chip-task-bg py-1.5 pl-3 pr-2 text-sm font-medium text-lumen-chip-task-fg">
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
              disabled={!hasTodos}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => hasTodos && setOpen((v) => !v)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lumen-md border border-lumen-border-strong bg-lumen-bg px-3 py-[9px] text-sm text-lumen-text-secondary",
                "hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                !hasTodos && "cursor-not-allowed opacity-55 hover:bg-lumen-bg",
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
              {todos.map((t) => (
                <MenuItem
                  key={t.id}
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

      {!loading && !hasTodos && !selected ? (
        <p className="pl-[88px] text-xs text-lumen-text-tertiary">
          {labels.emptyHint}
        </p>
      ) : null}
    </Card>
  );
}
