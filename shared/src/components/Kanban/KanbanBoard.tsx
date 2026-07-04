/*
 * KanbanBoard (K1) — board root. Pure presentation: the host injects the
 * already-built columns per view mode + copy (§6.4). The 3-view segmented
 * control (folder / status / tag) lives here; the active mode is internal
 * state persisted to localStorage so the choice survives reloads, but the
 * host can also drive it via `viewMode` (controlled) if it prefers.
 *
 * The board is a horizontal-scroll full-width strip (the host removes the
 * section max-w wrapper for tasks). Columns are pre-built by the host with
 * buildFolderColumns / buildStatusColumns / buildTagColumns so this stays
 * pure and testable.
 */

import { Folder, CircleDot, Tag, type LucideIcon } from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";
import { cn } from "../cn";
import { KanbanColumn } from "./KanbanColumn";
import type { KanbanColumnModel, KanbanLabels, KanbanViewMode } from "./types";
import { readKanbanViewMode, persistKanbanViewMode } from "./viewModeStorage";

const VIEW_ORDER: readonly KanbanViewMode[] = ["folder", "status", "tag"];

const VIEW_ICON: Record<KanbanViewMode, LucideIcon> = {
  folder: Folder,
  status: CircleDot,
  tag: Tag,
};

export interface KanbanBoardProps {
  /** Columns for the CURRENTLY active view, pre-built by the host. */
  columns: KanbanColumnModel[];
  labels: KanbanLabels;
  onSelectCard: (id: string) => void;
  /** Controlled mode (optional). When provided, the board reflects it and
   *  reports changes via onViewModeChange instead of self-persisting. */
  viewMode?: KanbanViewMode;
  onViewModeChange?: (mode: KanbanViewMode) => void;
  /** Default uncontrolled mode (ignored when `viewMode` is provided). */
  defaultViewMode?: KanbanViewMode;
  /** Set a folder / tag column's color (K2). Threaded to the plain columns and
   *  available to the host's renderColumn closure for the DnD path. null =
   *  clear. */
  onColorChange?: (columnId: string, color: string | null) => void;
  /** Optional actions rendered on the trailing side of the board toolbar
   *  (next to the segmented control) — the host slots its "+ Add" entry here. */
  headerActions?: React.ReactNode;
  /**
   * Optional column renderer override. The host uses this to wrap each column
   * in its own @dnd-kit droppable host component (so the shared package never
   * imports @dnd-kit). `showFolderPill` / `showTags` are threaded through so
   * the host can forward them to the shared KanbanColumn. When omitted, the
   * board renders the plain (non-DnD) KanbanColumn itself — used by read-only
   * views (e.g. the tag view).
   */
  renderColumn?: (args: {
    column: KanbanColumnModel;
    showFolderPill: boolean;
    showTags: boolean;
    showFolderAccent: boolean;
  }) => React.ReactNode;
  /**
   * Optional slot rendered after the board strip — the host places its
   * @dnd-kit <DragOverlay> here. The host wraps the whole <KanbanBoard> in its
   * own <DndContext>, so the overlay portal must live inside that provider.
   */
  overlay?: React.ReactNode;
}

export function KanbanBoard({
  columns,
  labels,
  onSelectCard,
  viewMode,
  onViewModeChange,
  defaultViewMode = "folder",
  onColorChange,
  renderColumn,
  overlay,
  headerActions,
}: KanbanBoardProps): React.JSX.Element {
  const isControlled = viewMode !== undefined;
  const [internalMode, setInternalMode] = useState<KanbanViewMode>(() =>
    readKanbanViewMode(defaultViewMode),
  );
  const activeMode = isControlled ? viewMode : internalMode;

  // Persist the uncontrolled choice. Controlled mode leaves persistence to
  // the host.
  useEffect(() => {
    if (isControlled) return;
    persistKanbanViewMode(internalMode);
  }, [isControlled, internalMode]);

  const selectMode = useCallback(
    (mode: KanbanViewMode) => {
      if (!isControlled) setInternalMode(mode);
      onViewModeChange?.(mode);
    },
    [isControlled, onViewModeChange],
  );

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

  // Folder view: the column already conveys the folder, so cards omit the
  // pill. Status/tag views: show the folder pill on each card.
  const showFolderPill = activeMode !== "folder";
  // Tag view: the column already conveys the tag, so cards omit tag chips.
  // Folder/status views: show tag chips on each card.
  const showTags = activeMode !== "tag";
  // Folder view: tint each card with its folder's color (the column groups by
  // folder, so the wash ties its cards to it). Other views: no folder wash.
  const showFolderAccent = activeMode === "folder";

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar — segmented control (3 view modes) + host header actions */}
      <div className="flex items-center justify-between gap-3 px-1 pb-4">
        <div
          role="tablist"
          aria-label={labels.segmentedGroupLabel}
          className="inline-flex gap-0.5 rounded-xl border border-lumen-border bg-lumen-bg-secondary p-0.5"
        >
          {VIEW_ORDER.map((mode) => {
            const Icon = VIEW_ICON[mode];
            const selected = mode === activeMode;
            return (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => selectMode(mode)}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5",
                  "text-[0.8125rem] font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
                  selected
                    ? "bg-lumen-bg text-lumen-text shadow-lumen-sm"
                    : "text-lumen-text-secondary hover:text-lumen-text",
                )}
              >
                <Icon size={15} aria-hidden />
                {viewLabel(mode)}
              </button>
            );
          })}
        </div>
        {headerActions}
      </div>

      {/* Board — horizontal-scroll column strip. The outer div owns the
          scroll; the inner row is `w-fit mx-auto` so the columns center when
          they fit the viewport and stay flush-left (no clipping) when they
          overflow and scroll. `justify-center` alone would clip the left edge
          on overflow, so we deliberately avoid it. */}
      <div className="flex-1 overflow-x-auto px-1 pb-4">
        <div
          role="list"
          aria-label={viewLabel(activeMode)}
          className="mx-auto flex h-full w-fit max-w-full gap-4"
        >
          {columns.map((column) =>
            renderColumn ? (
              <Fragment key={column.id}>
                {renderColumn({
                  column,
                  showFolderPill,
                  showTags,
                  showFolderAccent,
                })}
              </Fragment>
            ) : (
              <KanbanColumn
                key={column.id}
                column={column}
                labels={labels}
                showFolderPill={showFolderPill}
                showTags={showTags}
                showFolderAccent={showFolderAccent}
                onSelectCard={onSelectCard}
                onColorChange={onColorChange}
              />
            ),
          )}
        </div>
      </div>
      {overlay}
    </div>
  );
}
