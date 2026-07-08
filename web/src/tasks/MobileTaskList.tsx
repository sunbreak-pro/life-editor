import { useMemo, useState } from "react";
import {
  Circle,
  CircleDashed,
  CheckCircle2,
  ListTodo,
  Plus,
  type LucideIcon,
} from "lucide-react";
import {
  BottomSheet,
  EmptyState,
  KanbanCard,
  QuickAddSheet,
  StatusFilterChips,
  cn,
  type KanbanColumnModel,
  type KanbanLabels,
  type StatusFilterChip,
  type TaskStatus,
} from "@life-editor/shared";

/*
 * Mobile Tasks list (Materials mini-plan Step 2, narrow layout). The brief
 * strips the desktop board down for touch: no DnD, no horizontal columns, no
 * color / tag / folder view switching. Instead —
 *
 *   - a single-select StatusFilterChips row (未着手 / 進行中 / 完了 with live
 *     counts; re-tapping the active chip clears back to "all"),
 *   - a full-width vertical card list across ALL folders (reusing the shared
 *     KanbanCard with its folder pill + tag chips so the visual matches the
 *     desktop card 1:1),
 *   - tapping a card opens a ~60% BottomSheet with the 3 status choices
 *     (picking one sets the status + closes),
 *   - a "+" CTA opens a QuickAddSheet (title-only capture).
 *
 * Data stays host-side: KanbanView builds the three status columns (cards
 * already carry folderName / folderColor / tags via the pure builder) and
 * injects them here + the status-mutation / quick-add callbacks. This leaf is
 * DataService-free (§3.1) and takes all copy as props (§6.4).
 */

const STATUS_ORDER: readonly TaskStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "DONE",
];

const STATUS_ICON: Record<TaskStatus, LucideIcon> = {
  NOT_STARTED: Circle,
  IN_PROGRESS: CircleDashed,
  DONE: CheckCircle2,
};

export interface MobileTaskListLabels {
  /** Per-status chip / sheet labels (already-translated, §6.4). */
  statusNotStarted: string;
  statusInProgress: string;
  statusDone: string;
  /** Accessible name for the filter chip group. */
  filterLabel: string;
  /** Title of the status-change BottomSheet. */
  statusSheetTitle: string;
  /** Empty-state message + accent CTA label. */
  empty: string;
  addCta: string;
  /** QuickAddSheet copy. */
  quickAddTitle: string;
  quickAddPlaceholder: string;
  quickAddSubmit: string;
}

export interface MobileTaskListProps {
  /** The three status columns (from buildStatusColumns) — cards already carry
   *  folder pill + tags. */
  statusColumns: KanbanColumnModel[];
  /** KanbanCard copy (shared with the desktop board). */
  cardLabels: KanbanLabels;
  labels: MobileTaskListLabels;
  onSetStatus: (id: string, status: TaskStatus) => void;
  onQuickAdd: (title: string) => void;
}

function statusLabelOf(
  status: TaskStatus,
  labels: MobileTaskListLabels,
): string {
  switch (status) {
    case "NOT_STARTED":
      return labels.statusNotStarted;
    case "IN_PROGRESS":
      return labels.statusInProgress;
    case "DONE":
      return labels.statusDone;
  }
}

export function MobileTaskList({
  statusColumns,
  cardLabels,
  labels,
  onSetStatus,
  onQuickAdd,
}: MobileTaskListProps): React.JSX.Element {
  const [filter, setFilter] = useState<TaskStatus | null>(null);
  const [sheetTaskId, setSheetTaskId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Index the columns by status for O(1) lookups (counts + filtered cards).
  const columnByStatus = useMemo(() => {
    const map = new Map<TaskStatus, KanbanColumnModel>();
    for (const col of statusColumns) {
      if (col.statusKind) map.set(col.statusKind, col);
    }
    return map;
  }, [statusColumns]);

  const chips: StatusFilterChip[] = STATUS_ORDER.map((status) => {
    const Icon = STATUS_ICON[status];
    return {
      id: status,
      label: statusLabelOf(status, labels),
      count: columnByStatus.get(status)?.cards.length ?? 0,
      icon: <Icon size={13} aria-hidden />,
    };
  });

  // Flatten to the visible card list: the active filter's column, or every
  // status column concatenated (status order) when no filter is set.
  const visibleCards = useMemo(() => {
    if (filter) return columnByStatus.get(filter)?.cards ?? [];
    return STATUS_ORDER.flatMap(
      (status) => columnByStatus.get(status)?.cards ?? [],
    );
  }, [filter, columnByStatus]);

  // Resolve the current status of the card whose sheet is open (to highlight
  // the active choice) — cards live inside their status column.
  const sheetStatus: TaskStatus | null = useMemo(() => {
    if (!sheetTaskId) return null;
    for (const status of STATUS_ORDER) {
      const col = columnByStatus.get(status);
      if (col?.cards.some((c) => c.id === sheetTaskId)) return status;
    }
    return null;
  }, [sheetTaskId, columnByStatus]);

  return (
    <div className="flex h-full flex-col px-4 pt-2">
      {/* Action row — status filter chips (scrollable) + "+" quick-add CTA. */}
      <div className="flex items-center gap-2 pb-3">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <StatusFilterChips
            chips={chips}
            value={filter}
            onChange={(id) => setFilter(id as TaskStatus | null)}
            label={labels.filterLabel}
            className="flex-nowrap"
          />
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          aria-label={labels.addCta}
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
            "bg-lumen-accent text-lumen-on-accent shadow-lumen-sm",
            "transition-opacity hover:opacity-90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
          )}
        >
          <Plus size={18} aria-hidden />
        </button>
      </div>

      {/* Card list — full-width vertical stack across all folders. */}
      {visibleCards.length === 0 ? (
        <EmptyState
          icon={<ListTodo aria-hidden />}
          message={labels.empty}
          cta={{ label: labels.addCta, onClick: () => setAddOpen(true) }}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pb-4">
          {visibleCards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              labels={cardLabels}
              showFolderPill
              showTags
              onSelect={setSheetTaskId}
            />
          ))}
        </div>
      )}

      {/* Status-change sheet (~60% height). Picking a status sets it + closes. */}
      <BottomSheet
        open={sheetTaskId !== null}
        onClose={() => setSheetTaskId(null)}
        title={labels.statusSheetTitle}
      >
        <div className="flex flex-col gap-2">
          {STATUS_ORDER.map((status) => {
            const Icon = STATUS_ICON[status];
            const active = status === sheetStatus;
            return (
              <button
                key={status}
                type="button"
                onClick={() => {
                  if (sheetTaskId) onSetStatus(sheetTaskId, status);
                  setSheetTaskId(null);
                }}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm",
                  "transition-colors focus-visible:outline-none",
                  "focus-visible:ring-2 focus-visible:ring-lumen-accent",
                  active
                    ? "border-lumen-accent bg-lumen-accent-subtle font-semibold text-lumen-accent"
                    : "border-lumen-border bg-lumen-bg text-lumen-text hover:bg-lumen-hover",
                )}
              >
                <Icon size={16} aria-hidden className="shrink-0" />
                {statusLabelOf(status, labels)}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      <QuickAddSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={labels.quickAddTitle}
        placeholder={labels.quickAddPlaceholder}
        submitLabel={labels.quickAddSubmit}
        onSubmit={onQuickAdd}
      />
    </div>
  );
}
