import { useMemo, useState, type ReactNode } from "react";
import { ListTodo, Plus } from "lucide-react";
import {
  BottomSheet,
  EmptyState,
  KanbanCard,
  QuickAddSheet,
  StatusFilterChips,
  STATUS_ICON,
  STATUS_ORDER,
  statusLabel,
  cn,
  type KanbanColumnModel,
  type KanbanLabels,
  type StatusFilterChip,
  type TodoStatus,
} from "@life-editor/shared";

/*
 * Mobile Todos list (Materials mini-plan Step 2, narrow layout). The brief
 * strips the desktop board down for touch: no DnD, no horizontal columns, no
 * color / tag view switching. Instead —
 *
 *   - a single-select StatusFilterChips row (未着手 / 進行中 / 完了 with live
 *     counts; re-tapping the active chip clears back to "all"),
 *   - a full-width vertical card list (reusing the shared KanbanCard with its
 *     tag chips so the visual matches the desktop card 1:1),
 *   - tapping a card opens the detail sheet (#470) — a tall BottomSheet hosting
 *     the injected <TodoDetailPanel>: title, status, tags and rich-text body,
 *     all editable. It replaced the status-only sheet this list shipped with
 *     (mobile-scope.md #6 Phase 2). DnD and the kanban column operations stay
 *     Desktop-only.
 *   - a "+" CTA opens a QuickAddSheet (title-only capture).
 *
 * Data stays host-side: KanbanView builds the three status columns (cards
 * already carry their tags via the pure builder) and injects them here + the
 * quick-add callback + the detail node itself. The detail identity lives in the
 * host too (`detailTodoId`), because the panel it renders needs the todo's own
 * content and tag context — which is also how a "[[" link jump can open this
 * sheet without reaching into the list's state. This leaf is DataService-free
 * (§3.1) and takes all copy as props (§6.4).
 */

export interface MobileTodoListLabels {
  /** Per-status chip / sheet labels (already-translated, §6.4). */
  statusNotStarted: string;
  statusInProgress: string;
  statusDone: string;
  /** Accessible name for the filter chip group. */
  filterLabel: string;
  /** Title of the detail BottomSheet. Generic ("Todo details") rather than the
   *  todo's own title, which the panel's first field already shows. */
  detailTitle: string;
  /** Name for the close button both sheets carry (#525). */
  close: string;
  /** Empty-state message + accent CTA label. */
  empty: string;
  addCta: string;
  /** QuickAddSheet copy. */
  quickAddTitle: string;
  quickAddPlaceholder: string;
  quickAddSubmit: string;
}

export interface MobileTodoListProps {
  /** The three status columns (from buildStatusColumns) — cards already carry
   *  their tag chips. */
  statusColumns: KanbanColumnModel[];
  /** KanbanCard copy (shared with the desktop board). */
  cardLabels: KanbanLabels;
  labels: MobileTodoListLabels;
  onQuickAdd: (title: string) => void;
  /** Todo whose detail sheet is open (host-owned — see the file header), or
   *  null for closed. */
  detailTodoId: string | null;
  /** A card was tapped: the host selects that todo and opens the sheet. */
  onSelectTodo: (id: string) => void;
  onCloseDetail: () => void;
  /** The open todo's detail panel, built by the host (TodoDetailPanel + the web
   *  TipTap editor + TagPicker). Rendered inside the sheet. */
  detail?: ReactNode;
}

export function MobileTodoList({
  statusColumns,
  cardLabels,
  labels,
  onQuickAdd,
  detailTodoId,
  onSelectTodo,
  onCloseDetail,
  detail,
}: MobileTodoListProps): React.JSX.Element {
  const [filter, setFilter] = useState<TodoStatus | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Index the columns by status for O(1) lookups (counts + filtered cards).
  const columnByStatus = useMemo(() => {
    const map = new Map<TodoStatus, KanbanColumnModel>();
    for (const col of statusColumns) {
      if (col.statusKind) map.set(col.statusKind, col);
    }
    return map;
  }, [statusColumns]);

  const chips: StatusFilterChip[] = STATUS_ORDER.map((status) => {
    const Icon = STATUS_ICON[status];
    return {
      id: status,
      label: statusLabel(status, labels),
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

  return (
    <div className="flex h-full flex-col px-4 pt-2">
      {/* Action row — status filter chips (scrollable) + "+" quick-add CTA. */}
      <div className="flex items-center gap-2 pb-3">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <StatusFilterChips
            chips={chips}
            value={filter}
            onChange={(id) => setFilter(id as TodoStatus | null)}
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

      {/* Card list — full-width vertical stack across all todos. */}
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
              showTags
              onSelect={onSelectTodo}
            />
          ))}
        </div>
      )}

      {/* Detail screen (#470) — scrollable, so the rich-text body has room. It
          covers the card list rather than leaving a strip of it showing (#874):
          the strip moved whenever the keyboard opened, which read as the list
          heaving behind the panel. The panel inside is host-built; this list
          only owns the shell. */}
      <BottomSheet
        open={detailTodoId !== null}
        onClose={onCloseDetail}
        title={labels.detailTitle}
        closeLabel={labels.close}
        fullScreen
      >
        {detail}
      </BottomSheet>

      <QuickAddSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={labels.quickAddTitle}
        closeLabel={labels.close}
        placeholder={labels.quickAddPlaceholder}
        submitLabel={labels.quickAddSubmit}
        onSubmit={onQuickAdd}
      />
    </div>
  );
}
