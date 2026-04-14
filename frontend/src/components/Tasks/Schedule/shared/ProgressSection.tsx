import { useCallback } from "react";
import { Check, GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TabItem } from "../../../shared/SectionTabs";
import type { DayFlowFilterTab } from "../DayFlow/OneDaySchedule";
import { DAY_FLOW_FILTER_TABS } from "../DayFlow/OneDaySchedule";
import type { CategoryProgress } from "../DayFlow/DayFlowSidebarContent";

interface ProgressSectionProps {
  date: Date;
  categoryProgress: Record<DayFlowFilterTab, CategoryProgress>;
  activeFilters: Set<DayFlowFilterTab>;
  onToggleFilter: (tab: DayFlowFilterTab) => void;
  tabs?: readonly TabItem<DayFlowFilterTab>[];
  onReorderTabs?: (newOrder: DayFlowFilterTab[]) => void;
}

function SortableProgressItem({
  tab,
  isActive,
  progress,
  pct,
  onToggleFilter,
  reorderable,
}: {
  tab: TabItem<DayFlowFilterTab>;
  isActive: boolean;
  progress: CategoryProgress;
  pct: number;
  onToggleFilter: (tab: DayFlowFilterTab) => void;
  reorderable: boolean;
}) {
  const { t } = useTranslation();
  const isAll = tab.id === "all";
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id, disabled: isAll || !reorderable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center group">
      {reorderable && !isAll ? (
        <div
          className="pl-1 pr-0.5 cursor-grab opacity-0 group-hover:opacity-60 transition-opacity shrink-0 text-notion-text-secondary"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={10} />
        </div>
      ) : (
        <div className="w-[18px] shrink-0" />
      )}
      <button
        onClick={() => onToggleFilter(tab.id)}
        className={`flex-1 flex items-center gap-2 pr-3 py-1.5 text-left transition-colors ${
          isActive ? "bg-notion-hover" : "hover:bg-notion-hover/50"
        }`}
      >
        <div
          className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
            isActive
              ? "bg-notion-accent border-notion-accent"
              : "border-notion-border"
          }`}
        >
          {isActive && <Check size={10} className="text-white" />}
        </div>
        <span
          className={`flex-1 text-xs ${
            isActive
              ? "text-notion-text font-medium"
              : "text-notion-text-secondary"
          }`}
        >
          {t(tab.labelKey)}
        </span>
        <span
          className={`text-[11px] tabular-nums ${
            isActive ? "text-notion-text" : "text-notion-text-secondary"
          }`}
        >
          {progress.completed}/{progress.total}
        </span>
        <div className="w-10 h-1 bg-notion-hover rounded-full overflow-hidden">
          <div
            className="h-full bg-notion-accent rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </button>
    </div>
  );
}

export function ProgressSection({
  date,
  categoryProgress,
  activeFilters,
  onToggleFilter,
  tabs,
  onReorderTabs,
}: ProgressSectionProps) {
  const { t } = useTranslation();
  const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;

  const allTabs = tabs ?? DAY_FLOW_FILTER_TABS;
  const reorderable = !!onReorderTabs;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 3 },
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !onReorderTabs) return;

      // Only reorder non-"all" tabs
      const sortable = allTabs.filter((t) => t.id !== "all");
      const oldIndex = sortable.findIndex((t) => t.id === active.id);
      const newIndex = sortable.findIndex((t) => t.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(sortable, oldIndex, newIndex);
      onReorderTabs(reordered.map((t) => t.id));
    },
    [allTabs, onReorderTabs],
  );

  const sortableIds = allTabs.filter((t) => t.id !== "all").map((t) => t.id);

  const allTab = allTabs.find((t) => t.id === "all");
  const sortableTabs = allTabs.filter((t) => t.id !== "all");

  const renderItem = (tab: TabItem<DayFlowFilterTab>) => {
    const progress = categoryProgress[tab.id];
    const isActive =
      tab.id === "all" ? activeFilters.size === 0 : activeFilters.has(tab.id);
    const pct =
      progress.total > 0
        ? Math.round((progress.completed / progress.total) * 100)
        : 0;

    return (
      <SortableProgressItem
        key={tab.id}
        tab={tab}
        isActive={isActive}
        progress={progress}
        pct={pct}
        onToggleFilter={onToggleFilter}
        reorderable={reorderable}
      />
    );
  };

  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-notion-text-secondary uppercase tracking-wide font-medium px-3 py-1.5">
        {t("dayFlow.sidebarProgress", "Progress")}{" "}
        <span className="normal-case">({dateLabel})</span>
      </span>
      {allTab && renderItem(allTab)}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortableIds}
          strategy={verticalListSortingStrategy}
        >
          {sortableTabs.map(renderItem)}
        </SortableContext>
      </DndContext>
    </div>
  );
}
