import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRoutineContext } from "../../hooks/useRoutineContext";
import { RoutineList } from "./RoutineList";
import { RoutineCreateDialog } from "./RoutineCreateDialog";
import type { RoutineNode, FrequencyType } from "../../types/routine";

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RoutineView() {
  const { t } = useTranslation();
  const routineContext = useRoutineContext();
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<RoutineNode | null>(null);

  const todayKey = getTodayKey();

  const handleCreate = (
    title: string,
    frequencyType: FrequencyType,
    frequencyDays: number[],
  ) => {
    routineContext.createRoutine(title, frequencyType, frequencyDays);
    setShowDialog(false);
  };

  const handleEdit = (routine: RoutineNode) => {
    setEditTarget(routine);
  };

  const handleEditSubmit = (
    title: string,
    frequencyType: FrequencyType,
    frequencyDays: number[],
  ) => {
    if (!editTarget) return;
    routineContext.updateRoutine(editTarget.id, {
      title,
      frequencyType,
      frequencyDays,
    });
    setEditTarget(null);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-notion-border shrink-0">
        <h2 className="text-sm font-semibold text-notion-text">
          {t("routine.title")}
        </h2>
        <button
          onClick={() => setShowDialog(true)}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-notion-hover text-notion-text-secondary transition-colors"
          title={t("routine.addRoutine")}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {routineContext.routines.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-notion-text-secondary">
            {t("routine.noRoutines")}
          </div>
        ) : (
          <RoutineList
            routines={routineContext.routines}
            routineContext={routineContext}
            todayKey={todayKey}
            onEdit={handleEdit}
          />
        )}
      </div>

      {/* Create Dialog */}
      {showDialog && (
        <RoutineCreateDialog
          onSubmit={handleCreate}
          onClose={() => setShowDialog(false)}
        />
      )}

      {/* Edit Dialog */}
      {editTarget && (
        <RoutineCreateDialog
          onSubmit={handleEditSubmit}
          onClose={() => setEditTarget(null)}
          initial={{
            title: editTarget.title,
            frequencyType: editTarget.frequencyType,
            frequencyDays: editTarget.frequencyDays,
          }}
        />
      )}
    </div>
  );
}
