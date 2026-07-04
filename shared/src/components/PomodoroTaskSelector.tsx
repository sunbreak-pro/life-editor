import { X } from "lucide-react";
import { Card } from "./Card";
import { IconButton } from "./IconButton";
import { cn } from "./cn";

/*
 * Task attribution selector for the Work tab (W3-B). Pomodoro sessions can be
 * linked to a task (task_id on timer_sessions). Pure primitive: the host
 * supplies the candidate tasks + selection state + copy (§6.4). When no task
 * is selected it shows a placeholder picker; when one is, it shows a chip with
 * a clear button. Keeps History / Music / FREE OUT (section-unification 確定);
 * TaskSelector is the only retained Work-tab side panel.
 */

export interface TaskOption {
  id: string;
  title: string;
}

export interface PomodoroTaskSelectorLabels {
  heading: string;
  placeholder: string;
  none: string;
  clear: string;
}

export interface PomodoroTaskSelectorProps {
  tasks: readonly TaskOption[];
  selectedId: string | null;
  labels: PomodoroTaskSelectorLabels;
  onSelect: (task: TaskOption | null) => void;
}

export function PomodoroTaskSelector({
  tasks,
  selectedId,
  labels,
  onSelect,
}: PomodoroTaskSelectorProps) {
  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  return (
    <Card padding="md" className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-lumen-text-secondary">
        {labels.heading}
      </h3>
      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-md bg-lumen-bg-secondary px-3 py-2">
          <span className="truncate text-sm text-lumen-text">
            {selected.title}
          </span>
          <IconButton
            icon={<X size={16} />}
            label={labels.clear}
            variant="ghost"
            size="sm"
            onClick={() => onSelect(null)}
          />
        </div>
      ) : (
        <select
          value=""
          onChange={(e) => {
            const next = tasks.find((t) => t.id === e.target.value) ?? null;
            onSelect(next);
          }}
          className={cn(
            "h-9 w-full rounded-md border border-lumen-border bg-lumen-bg px-3",
            "text-sm text-lumen-text focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-lumen-accent",
          )}
        >
          <option value="" disabled>
            {tasks.length === 0 ? labels.none : labels.placeholder}
          </option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      )}
    </Card>
  );
}
