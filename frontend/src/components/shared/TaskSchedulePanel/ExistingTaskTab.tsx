import { useState, useCallback } from "react";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TaskPickerTree } from "./TaskPickerTree";
import { TimeSettingsInline } from "./TimeSettingsInline";
import type { TaskNode } from "../../../types/taskTree";

interface ScheduleParams {
  scheduledAt: string;
  scheduledEndAt?: string;
  isAllDay?: boolean;
}

interface ExistingTaskTabProps {
  date: Date;
  defaultStartTime: string;
  defaultEndTime: string;
  existingTaskIds?: Set<string>;
  onSelectExistingTask: (task: TaskNode, schedule: ScheduleParams) => void;
  onClose: () => void;
}

export function ExistingTaskTab({
  date,
  defaultStartTime,
  defaultEndTime,
  existingTaskIds,
  onSelectExistingTask,
  onClose,
}: ExistingTaskTabProps) {
  const { t } = useTranslation();
  const [selectedTask, setSelectedTask] = useState<TaskNode | null>(null);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const [isAllDay, setIsAllDay] = useState(false);
  const [hasEndTime, setHasEndTime] = useState(true);

  const handleTaskSelect = useCallback((task: TaskNode) => {
    setSelectedTask(task);
    // Pre-fill time from existing schedule
    if (task.scheduledAt) {
      const d = new Date(task.scheduledAt);
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      setStartTime(`${h}:${m}`);
      if (task.scheduledEndAt) {
        const de = new Date(task.scheduledEndAt);
        setEndTime(
          `${String(de.getHours()).padStart(2, "0")}:${String(de.getMinutes()).padStart(2, "0")}`,
        );
        setHasEndTime(true);
      } else {
        const dur = task.workDurationMinutes ?? 25;
        const endDate = new Date(d.getTime() + dur * 60000);
        setEndTime(
          `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`,
        );
        setHasEndTime(true);
      }
      setIsAllDay(false);
    }
  }, []);

  const handleConfirm = () => {
    if (!selectedTask) return;

    if (isAllDay) {
      const scheduledDate = new Date(date);
      scheduledDate.setHours(0, 0, 0, 0);
      onSelectExistingTask(selectedTask, {
        scheduledAt: scheduledDate.toISOString(),
        isAllDay: true,
      });
    } else {
      const [sh, sm] = startTime.split(":").map(Number);
      const scheduledDate = new Date(date);
      scheduledDate.setHours(sh, sm, 0, 0);

      const schedule: ScheduleParams = {
        scheduledAt: scheduledDate.toISOString(),
      };

      if (hasEndTime) {
        const [eh, em] = endTime.split(":").map(Number);
        const scheduledEndDate = new Date(date);
        scheduledEndDate.setHours(eh, em, 0, 0);
        schedule.scheduledEndAt = scheduledEndDate.toISOString();
      }

      onSelectExistingTask(selectedTask, schedule);
    }
    onClose();
  };

  return (
    <div className="p-3">
      <TaskPickerTree
        selectedTaskId={selectedTask?.id ?? null}
        onSelectTask={handleTaskSelect}
        existingTaskIds={existingTaskIds}
      />

      {selectedTask && (
        <div className="mt-2">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-notion-text-secondary" />
            <span className="text-xs font-medium text-notion-text truncate">
              {selectedTask.title}
            </span>
          </div>

          <TimeSettingsInline
            isAllDay={isAllDay}
            onAllDayChange={setIsAllDay}
            startTime={startTime}
            onStartTimeChange={setStartTime}
            hasEndTime={hasEndTime}
            onHasEndTimeChange={setHasEndTime}
            endTime={endTime}
            onEndTimeChange={setEndTime}
          />

          <button
            onClick={handleConfirm}
            className="w-full mt-2 px-3 py-1.5 text-xs bg-notion-accent text-white rounded-md hover:bg-notion-accent/90 transition-colors"
          >
            {t("schedule.create")}
          </button>
          <button
            onClick={() => setSelectedTask(null)}
            className="w-full mt-1 py-1 text-xs text-notion-text-secondary hover:text-notion-text text-center transition-colors"
          >
            {t("common.cancel")}
          </button>
        </div>
      )}
    </div>
  );
}
