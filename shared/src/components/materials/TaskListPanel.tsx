import { useState } from "react";
import {
  Folder,
  CircleDot,
  Tag,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../cn";
import type { TaskStatus } from "../../types/taskTree";
import type {
  KanbanCardModel,
  KanbanColumnModel,
  KanbanViewMode,
} from "../Kanban/types";

/*
 * Task list panel (Tasks list-mode). The vertical-list counterpart of the
 * Kanban board: the Tasks tab pushes this into the shared rightSidebar (Desktop
 * only) as always-present nav content, and the selected task's detail fills the
 * main surface. Pure presentation, DataService-free (§3.1): the host builds the
 * grouped columns with the pure Kanban builders (buildFolderColumns /
 * buildStatusColumns / buildTagColumns), injects the selection + copy, and
 * receives select / grouping intents via callbacks. lumen-* tokens only; @dnd-kit
 * is NOT imported here (reordering stays in the board mode's web layer).
 *
 * Layout: a grouping switch (folder / status / tag) heading, then one collapsible
 * group per column — a heading (accent dot + label + count + collapse toggle) and
 * the group's task rows (status glyph + title + optional folder pill + selection
 * highlight). Collapse state is local (view-only, not persisted).
 */

const VIEW_ORDER: readonly KanbanViewMode[] = ["folder", "status", "tag"];

const VIEW_ICON: Record<KanbanViewMode, LucideIcon> = {
  folder: Folder,
  status: CircleDot,
  tag: Tag,
};

// Status cue glyph — symbols, not copy (mirrors TaskDetailPanel's STATUS_GLYPH).
const STATUS_GLYPH: Record<TaskStatus, string> = {
  NOT_STARTED: "○",
  IN_PROGRESS: "◐",
  DONE: "●",
};

// Status band accent (design tokens — same CSS vars buildColumns uses).
const STATUS_BAND: Record<TaskStatus, string> = {
  NOT_STARTED: "var(--color-status-todo-band)",
  IN_PROGRESS: "var(--color-status-progress-band)",
  DONE: "var(--color-status-done-band)",
};

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lumen-bg";

/** All copy the panel needs, resolved by the host via t() (§6.4). */
export interface TaskListPanelLabels {
  /** Grouping switch: the three view-mode labels + its group aria-label. */
  viewFolder: string;
  viewStatus: string;
  viewTag: string;
  groupingGroupLabel: string;
  /** Status label per status (row aria — paired with the glyph). */
  statusNotStarted: string;
  statusInProgress: string;
  statusDone: string;
  /** Group collapse toggle aria (expanded → collapseGroup, collapsed → expandGroup). */
  expandGroup: string;
  collapseGroup: string;
  /** Fallback title for a task with no title. */
  untitled: string;
  /** Shown inside an expanded group with no tasks. */
  emptyGroup: string;
  /** a11y label for a group's task count. */
  countAriaLabel: (n: number) => string;
}

export interface TaskListPanelProps {
  /** Grouped columns for the active view, pre-built by the host. */
  columns: KanbanColumnModel[];
  /** Active grouping axis (drives the switch's selected state). */
  viewMode: KanbanViewMode;
  /** Host changes the grouping axis (persists + rebuilds columns). */
  onViewModeChange: (mode: KanbanViewMode) => void;
  /** Currently selected task id (accent-highlights its row). */
  selectedTaskId: string | null;
  /** Host selects a task (fills the main detail surface). */
  onSelectTask: (id: string) => void;
  labels: TaskListPanelLabels;
  className?: string;
}

function statusLabel(status: TaskStatus, labels: TaskListPanelLabels): string {
  switch (status) {
    case "NOT_STARTED":
      return labels.statusNotStarted;
    case "IN_PROGRESS":
      return labels.statusInProgress;
    case "DONE":
      return labels.statusDone;
  }
}

function TaskRow({
  card,
  selected,
  statusText,
  onSelect,
  untitled,
}: {
  card: KanbanCardModel;
  selected: boolean;
  statusText: string;
  onSelect: (id: string) => void;
  untitled: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(card.id)}
        aria-current={selected || undefined}
        className={cn(
          "group flex h-[34px] w-full items-center gap-2 rounded-lumen-md border px-2 text-left text-[13.5px]",
          selected
            ? "border-lumen-accent bg-lumen-accent-subtle"
            : "border-transparent hover:bg-lumen-hover",
          FOCUS_RING,
        )}
      >
        <span
          aria-hidden
          className="shrink-0 text-[11px] leading-none"
          style={{ color: STATUS_BAND[card.status] }}
          title={statusText}
        >
          {STATUS_GLYPH[card.status]}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            selected ? "text-lumen-accent" : "text-lumen-text",
          )}
        >
          {card.title || untitled}
        </span>
        {card.folderName && (
          <span className="shrink-0 max-w-[38%] truncate text-[11.5px] text-lumen-text-tertiary">
            {card.folderName}
          </span>
        )}
      </button>
    </li>
  );
}

export function TaskListPanel({
  columns,
  viewMode,
  onViewModeChange,
  selectedTaskId,
  onSelectTask,
  labels,
  className,
}: TaskListPanelProps) {
  // Collapsed group ids (view-only, not persisted). Groups start expanded.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const viewLabel = (mode: KanbanViewMode): string => {
    switch (mode) {
      case "folder":
        return labels.viewFolder;
      case "status":
        return labels.viewStatus;
      case "tag":
        return labels.viewTag;
    }
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Grouping switch — the list-mode home for the folder/status/tag axis. */}
      <div
        role="tablist"
        aria-label={labels.groupingGroupLabel}
        className="inline-flex gap-0.5 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary p-0.5"
      >
        {VIEW_ORDER.map((mode) => {
          const Icon = VIEW_ICON[mode];
          const selected = mode === viewMode;
          return (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onViewModeChange(mode)}
              className={cn(
                "inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[6px] px-2 py-1",
                "text-[12px] font-semibold transition-colors",
                FOCUS_RING,
                selected
                  ? "bg-lumen-bg text-lumen-text shadow-lumen-sm"
                  : "text-lumen-text-secondary hover:text-lumen-text",
              )}
            >
              <Icon size={13} aria-hidden className="shrink-0" />
              <span className="truncate">{viewLabel(mode)}</span>
            </button>
          );
        })}
      </div>

      {/* Groups. */}
      <div className="flex flex-col gap-2">
        {columns.map((column) => {
          const isCollapsed = collapsed.has(column.id);
          const count = column.cards.length;
          return (
            <div key={column.id} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => toggleCollapsed(column.id)}
                aria-expanded={!isCollapsed}
                aria-label={
                  isCollapsed ? labels.expandGroup : labels.collapseGroup
                }
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-lumen-md px-1 py-1 text-left hover:bg-lumen-hover",
                  FOCUS_RING,
                )}
              >
                {isCollapsed ? (
                  <ChevronRight
                    size={13}
                    aria-hidden
                    className="shrink-0 text-lumen-text-tertiary"
                  />
                ) : (
                  <ChevronDown
                    size={13}
                    aria-hidden
                    className="shrink-0 text-lumen-text-tertiary"
                  />
                )}
                <span
                  aria-hidden
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    column.accentColor ? "" : "bg-lumen-border-strong",
                  )}
                  style={
                    column.accentColor
                      ? { backgroundColor: column.accentColor }
                      : undefined
                  }
                />
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-lumen-text">
                  {column.title}
                </span>
                <span
                  aria-label={labels.countAriaLabel(count)}
                  className="shrink-0 rounded-full bg-lumen-bg-secondary px-1.5 text-[11px] font-medium text-lumen-text-tertiary"
                >
                  {count}
                </span>
              </button>

              {!isCollapsed &&
                (count === 0 ? (
                  <p className="px-2 py-1 text-[12px] text-lumen-text-tertiary">
                    {labels.emptyGroup}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-px">
                    {column.cards.map((card) => (
                      <TaskRow
                        key={card.id}
                        card={card}
                        selected={selectedTaskId === card.id}
                        statusText={statusLabel(card.status, labels)}
                        onSelect={onSelectTask}
                        untitled={labels.untitled}
                      />
                    ))}
                  </ul>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
