import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Archive, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineNode } from "../../../../types/routine";
import type { RoutineTag } from "../../../../types/routineTag";
import type {
  RoutineTemplate,
  RoutineStats,
  ScheduleItem,
} from "../../../../types/schedule";
import { RoutineEditDialog } from "./RoutineEditDialog";
import { RoutineTagManager } from "./RoutineTagManager";
import { TemplateManager } from "./TemplateManager";
import { AchievementPanel } from "./AchievementPanel";
import { AchievementDetailsOverlay } from "./AchievementDetailsOverlay";
import { RoutineFlow } from "./RoutineFlow";
import { useScheduleContext } from "../../../../hooks/useScheduleContext";
import { formatDateKey } from "../../../../utils/dateKey";

interface RoutinesTabProps {
  routines: RoutineNode[];
  templates: RoutineTemplate[];
  routineTags: RoutineTag[];
  onCreateRoutine: (
    title: string,
    startTime?: string,
    endTime?: string,
    tagId?: number | null,
  ) => void;
  onUpdateRoutine: (
    id: string,
    updates: Partial<
      Pick<
        RoutineNode,
        "title" | "startTime" | "endTime" | "isArchived" | "tagId"
      >
    >,
  ) => void;
  onDeleteRoutine: (id: string) => void;
  onCreateTemplate: (
    name: string,
    frequencyType: string,
    frequencyDays: number[],
    tagId?: number | null,
  ) => void;
  onUpdateTemplate: (
    id: string,
    updates: Partial<
      Pick<
        RoutineTemplate,
        "name" | "frequencyType" | "frequencyDays" | "tagId"
      >
    >,
  ) => void;
  onDeleteTemplate: (id: string) => void;
  onAddTemplateItem: (
    templateId: string,
    routineId: string,
    startTime?: string | null,
    endTime?: string | null,
  ) => void;
  onUpdateTemplateItem: (
    templateId: string,
    routineId: string,
    updates: { startTime?: string | null; endTime?: string | null },
  ) => void;
  onRemoveTemplateItem: (templateId: string, routineId: string) => void;
  getCompletionRate: (routineId: string) => {
    completed: number;
    total: number;
  };
  routineStats: RoutineStats | null;
  scheduleItems: ScheduleItem[];
  onToggleComplete: (id: string) => void;
  onCreateRoutineTag: (name: string, color: string) => Promise<RoutineTag>;
  onUpdateRoutineTag: (
    id: number,
    updates: Partial<Pick<RoutineTag, "name" | "color">>,
  ) => void;
  onDeleteRoutineTag: (id: number) => void;
  refreshRoutineStats: (routines: RoutineNode[]) => void;
}

export function RoutinesTab({
  routines,
  templates,
  routineTags,
  onCreateRoutine,
  onUpdateRoutine,
  onDeleteRoutine,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onAddTemplateItem,
  onUpdateTemplateItem,
  onRemoveTemplateItem,
  getCompletionRate,
  routineStats,
  scheduleItems,
  onToggleComplete,
  onCreateRoutineTag,
  onUpdateRoutineTag,
  onDeleteRoutineTag,
  refreshRoutineStats,
}: RoutinesTabProps) {
  const { t } = useTranslation();
  const { ensureTemplateItemsForDate, loadItemsForDate } = useScheduleContext();
  const [editDialog, setEditDialog] = useState<RoutineNode | "new" | null>(
    null,
  );
  const [showDetails, setShowDetails] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [selectedFilterTagId, setSelectedFilterTagId] = useState<number | null>(
    null,
  );

  // Ensure schedule items exist for today when RoutinesTab is opened directly
  useEffect(() => {
    const today = formatDateKey(new Date());
    loadItemsForDate(today);
  }, [loadItemsForDate]);

  useEffect(() => {
    if (templates.length > 0 && routines.length > 0) {
      const today = formatDateKey(new Date());
      ensureTemplateItemsForDate(today, templates, routines);
    }
  }, [templates, routines, ensureTemplateItemsForDate]);

  useEffect(() => {
    if (routines.length > 0) {
      refreshRoutineStats(routines);
    }
  }, [routines, refreshRoutineStats]);

  const activeRoutines = routines
    .filter((r) => !r.isArchived)
    .sort((a, b) =>
      (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"),
    );
  const filteredRoutines =
    selectedFilterTagId != null
      ? activeRoutines.filter((r) => r.tagId === selectedFilterTagId)
      : activeRoutines;
  const archivedRoutines = routines.filter((r) => r.isArchived);

  return (
    <div className="flex gap-4 h-full p-3">
      {/* Left column: Routine Flow */}
      <div className="w-1/2">
        <RoutineFlow
          templates={templates}
          routines={routines}
          scheduleItems={scheduleItems}
          onToggleComplete={onToggleComplete}
          filterTagId={selectedFilterTagId}
        />
      </div>

      {/* Right column: Achievement + Management */}
      <div className="w-1/2 flex flex-col gap-3">
        {routineStats && (
          <AchievementPanel
            stats={routineStats}
            onShowDetails={() => setShowDetails(true)}
          />
        )}

        {/* Management area: 2-column */}
        <div className="grid grid-cols-2 gap-3 flex-1 min-h-0 overflow-y-auto">
          {/* Routines CRUD */}
          <div className="min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-notion-text-secondary uppercase tracking-wide font-medium">
                Routines
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowTagManager(true)}
                  className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
                  title={t("schedule.manageTags", "Manage Tags")}
                >
                  <Tag size={14} />
                </button>
                <button
                  onClick={() => setEditDialog("new")}
                  className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Tag filter chips */}
            {routineTags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap mb-2">
                <button
                  onClick={() => setSelectedFilterTagId(null)}
                  className={`text-[11px] px-1.5 py-0.5 rounded-full transition-colors ${
                    selectedFilterTagId === null
                      ? "bg-notion-text text-notion-bg"
                      : "bg-notion-hover text-notion-text-secondary hover:text-notion-text"
                  }`}
                >
                  All
                </button>
                {routineTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() =>
                      setSelectedFilterTagId(
                        selectedFilterTagId === tag.id ? null : tag.id,
                      )
                    }
                    className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full transition-colors ${
                      selectedFilterTagId === tag.id
                        ? "ring-1 ring-notion-text"
                        : "hover:opacity-80"
                    }`}
                    style={{
                      backgroundColor: tag.color + "20",
                      color: tag.color,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </button>
                ))}
              </div>
            )}

            {filteredRoutines.length === 0 && (
              <p className="text-[11px] text-notion-text-secondary py-2">
                {selectedFilterTagId != null
                  ? "No routines with this tag."
                  : "No routines yet. Create one to get started."}
              </p>
            )}

            <div className="space-y-0.5">
              {filteredRoutines.map((routine) => {
                const rate = getCompletionRate(routine.id);
                return (
                  <div
                    key={routine.id}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-notion-border hover:bg-notion-hover group transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-notion-text truncate">
                          {routine.title}
                        </span>
                        {routine.tagId != null &&
                          (() => {
                            const tag = routineTags.find(
                              (t) => t.id === routine.tagId,
                            );
                            return tag ? (
                              <span
                                className="inline-flex items-center px-1.5 py-0 text-[10px] rounded-full text-white shrink-0"
                                style={{ backgroundColor: tag.color }}
                              >
                                {tag.name}
                              </span>
                            ) : null;
                          })()}
                      </div>
                      <div className="text-[11px] text-notion-text-secondary">
                        {routine.startTime && routine.endTime
                          ? `${routine.startTime} - ${routine.endTime}`
                          : routine.startTime
                            ? routine.startTime
                            : "No time set"}
                        {rate.total > 0 && (
                          <span className="ml-2">
                            {rate.completed}/{rate.total}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditDialog(routine)}
                        className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() =>
                          onUpdateRoutine(routine.id, { isArchived: true })
                        }
                        className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
                        title="Archive"
                      >
                        <Archive size={12} />
                      </button>
                      <button
                        onClick={() => onDeleteRoutine(routine.id)}
                        className="p-0.5 text-notion-text-secondary hover:text-red-500 rounded transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Archived */}
            {archivedRoutines.length > 0 && (
              <details className="mt-2">
                <summary className="text-[11px] text-notion-text-secondary cursor-pointer hover:text-notion-text transition-colors">
                  Archived ({archivedRoutines.length})
                </summary>
                <div className="mt-1 space-y-0.5">
                  {archivedRoutines.map((routine) => (
                    <div
                      key={routine.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-notion-hover group opacity-50"
                    >
                      <span className="flex-1 text-sm text-notion-text-secondary truncate">
                        {routine.title}
                      </span>
                      <button
                        onClick={() =>
                          onUpdateRoutine(routine.id, { isArchived: false })
                        }
                        className="opacity-0 group-hover:opacity-100 text-[11px] text-notion-text-secondary hover:text-notion-text transition-all"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* Templates */}
          <div className="min-w-0">
            <TemplateManager
              templates={templates}
              routines={routines}
              routineTags={routineTags}
              onCreateTemplate={onCreateTemplate}
              onUpdateTemplate={onUpdateTemplate}
              onDeleteTemplate={onDeleteTemplate}
              onAddItem={onAddTemplateItem}
              onUpdateItem={onUpdateTemplateItem}
              onRemoveItem={onRemoveTemplateItem}
              onCreateTag={onCreateRoutineTag}
            />
          </div>
        </div>
      </div>

      {editDialog && (
        <RoutineEditDialog
          routine={editDialog === "new" ? undefined : editDialog}
          tags={routineTags}
          onSubmit={(title, startTime, endTime, tagId) => {
            if (editDialog === "new") {
              onCreateRoutine(title, startTime, endTime, tagId);
            } else {
              onUpdateRoutine(editDialog.id, {
                title,
                startTime,
                endTime,
                tagId,
              });
            }
          }}
          onCreateTag={onCreateRoutineTag}
          onClose={() => setEditDialog(null)}
        />
      )}

      {showTagManager && (
        <RoutineTagManager
          tags={routineTags}
          onCreateTag={onCreateRoutineTag}
          onUpdateTag={onUpdateRoutineTag}
          onDeleteTag={onDeleteRoutineTag}
          onClose={() => setShowTagManager(false)}
        />
      )}

      {showDetails && routineStats && (
        <AchievementDetailsOverlay
          stats={routineStats}
          onClose={() => setShowDetails(false)}
        />
      )}
    </div>
  );
}
