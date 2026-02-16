import { useState } from "react";
import { Plus, Pencil, Trash2, Archive } from "lucide-react";
import type { RoutineNode } from "../../types/routine";
import type { RoutineTemplate } from "../../types/schedule";
import { RoutineEditDialog } from "./RoutineEditDialog";
import { TemplateManager } from "./TemplateManager";

interface RoutinesTabProps {
  routines: RoutineNode[];
  templates: RoutineTemplate[];
  onCreateRoutine: (
    title: string,
    startTime?: string,
    endTime?: string,
  ) => void;
  onUpdateRoutine: (
    id: string,
    updates: Partial<
      Pick<RoutineNode, "title" | "startTime" | "endTime" | "isArchived">
    >,
  ) => void;
  onDeleteRoutine: (id: string) => void;
  onCreateTemplate: (
    name: string,
    frequencyType: string,
    frequencyDays: number[],
  ) => void;
  onUpdateTemplate: (
    id: string,
    updates: Partial<
      Pick<RoutineTemplate, "name" | "frequencyType" | "frequencyDays">
    >,
  ) => void;
  onDeleteTemplate: (id: string) => void;
  onAddTemplateItem: (templateId: string, routineId: string) => void;
  onRemoveTemplateItem: (templateId: string, routineId: string) => void;
  getCompletionRate: (routineId: string) => {
    completed: number;
    total: number;
  };
}

export function RoutinesTab({
  routines,
  templates,
  onCreateRoutine,
  onUpdateRoutine,
  onDeleteRoutine,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onAddTemplateItem,
  onRemoveTemplateItem,
  getCompletionRate,
}: RoutinesTabProps) {
  const [editDialog, setEditDialog] = useState<RoutineNode | "new" | null>(
    null,
  );

  const activeRoutines = routines
    .filter((r) => !r.isArchived)
    .sort((a, b) =>
      (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"),
    );
  const archivedRoutines = routines.filter((r) => r.isArchived);

  return (
    <div className="px-3 py-2 space-y-4">
      {/* Routines section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-notion-text-secondary uppercase tracking-wide font-medium">
            Routines
          </span>
          <button
            onClick={() => setEditDialog("new")}
            className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        {activeRoutines.length === 0 && (
          <p className="text-[10px] text-notion-text-secondary py-2">
            No routines yet. Create one to get started.
          </p>
        )}

        <div className="space-y-0.5">
          {activeRoutines.map((routine) => {
            const rate = getCompletionRate(routine.id);
            return (
              <div
                key={routine.id}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-notion-border hover:bg-notion-hover group transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-notion-text truncate">
                    {routine.title}
                  </div>
                  <div className="text-[10px] text-notion-text-secondary">
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
            <summary className="text-[10px] text-notion-text-secondary cursor-pointer hover:text-notion-text transition-colors">
              Archived ({archivedRoutines.length})
            </summary>
            <div className="mt-1 space-y-0.5">
              {archivedRoutines.map((routine) => (
                <div
                  key={routine.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-notion-hover group opacity-50"
                >
                  <span className="flex-1 text-xs text-notion-text-secondary truncate">
                    {routine.title}
                  </span>
                  <button
                    onClick={() =>
                      onUpdateRoutine(routine.id, { isArchived: false })
                    }
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-notion-text-secondary hover:text-notion-text transition-all"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Templates section */}
      <TemplateManager
        templates={templates}
        routines={routines}
        onCreateTemplate={onCreateTemplate}
        onUpdateTemplate={onUpdateTemplate}
        onDeleteTemplate={onDeleteTemplate}
        onAddItem={onAddTemplateItem}
        onRemoveItem={onRemoveTemplateItem}
      />

      {editDialog && (
        <RoutineEditDialog
          routine={editDialog === "new" ? undefined : editDialog}
          onSubmit={(title, startTime, endTime) => {
            if (editDialog === "new") {
              onCreateRoutine(title, startTime, endTime);
            } else {
              onUpdateRoutine(editDialog.id, { title, startTime, endTime });
            }
          }}
          onClose={() => setEditDialog(null)}
        />
      )}
    </div>
  );
}
