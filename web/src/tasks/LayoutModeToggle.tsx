import { List, Columns3 } from "lucide-react";
import { cn } from "@life-editor/shared";
import type { TaskLayoutMode } from "./layoutMode";

/*
 * Tasks layout-mode toggle (web-owned). A self-contained 2-option control
 * (list / board) that lives in the Tasks content's top action row — kept out
 * of the shell's SegmentedControl on purpose (a parallel worktree owns that
 * component). Pure presentation: copy injected by the host (KanbanView), lumen-*
 * tokens only. Style mirrors the Kanban board's grouping tablist for a
 * consistent read. Persistence helpers live in ./layoutMode (this file exports
 * only the component — fast-refresh constraint).
 */

export interface LayoutModeToggleProps {
  mode: TaskLayoutMode;
  onChange: (mode: TaskLayoutMode) => void;
  /** Already-translated labels (§6.4). */
  listLabel: string;
  boardLabel: string;
  groupLabel: string;
}

export function LayoutModeToggle({
  mode,
  onChange,
  listLabel,
  boardLabel,
  groupLabel,
}: LayoutModeToggleProps): React.JSX.Element {
  const options = [
    { value: "list" as const, label: listLabel, Icon: List },
    { value: "board" as const, label: boardLabel, Icon: Columns3 },
  ];
  return (
    <div
      role="tablist"
      aria-label={groupLabel}
      className="inline-flex shrink-0 gap-0.5 rounded-xl border border-lumen-border bg-lumen-bg-secondary p-0.5"
    >
      {options.map(({ value, label, Icon }) => {
        const selected = value === mode;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(value)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5",
              "text-[0.8125rem] font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
              selected
                ? "bg-lumen-bg text-lumen-text shadow-lumen-sm"
                : "text-lumen-text-secondary hover:text-lumen-text",
            )}
          >
            <Icon size={15} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
