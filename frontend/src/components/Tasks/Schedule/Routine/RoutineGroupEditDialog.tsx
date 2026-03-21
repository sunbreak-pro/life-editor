import { useState, useCallback } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineGroup } from "../../../../types/routineGroup";
import type { RoutineTag } from "../../../../types/routineTag";
import type { RoutineNode } from "../../../../types/routine";
import { UnifiedColorPicker } from "../../../shared/UnifiedColorPicker";
import { RoutineGroupTagPicker } from "./RoutineGroupTagPicker";
import { timeToMinutes } from "../../../../utils/timeGridUtils";

interface RoutineGroupEditDialogProps {
  group?: RoutineGroup;
  tags: RoutineTag[];
  initialTagIds: number[];
  memberRoutines: RoutineNode[];
  groupTimeRange?: { startTime: string; endTime: string };
  onSubmit: (name: string, color: string, tagIds: number[]) => void;
  onSlideGroup?: (offsetMinutes: number) => void;
  onClose: () => void;
}

export function RoutineGroupEditDialog({
  group,
  tags,
  initialTagIds,
  memberRoutines,
  groupTimeRange,
  onSubmit,
  onSlideGroup,
  onClose,
}: RoutineGroupEditDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(group?.name ?? "");
  const [color, setColor] = useState(group?.color ?? "#6B7280");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(initialTagIds);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleSubmit = useCallback(() => {
    if (!name.trim()) return;
    onSubmit(name.trim(), color, selectedTagIds);
    onClose();
  }, [name, color, selectedTagIds, onSubmit, onClose]);

  const handleSlide = useCallback(
    (newStartTime: string) => {
      if (!groupTimeRange || !onSlideGroup) return;
      const currentStart = timeToMinutes(groupTimeRange.startTime);
      const newStart = timeToMinutes(newStartTime);
      const offset = newStart - currentStart;
      if (offset !== 0) {
        onSlideGroup(offset);
      }
    },
    [groupTimeRange, onSlideGroup],
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-notion-bg border border-notion-border rounded-lg shadow-xl w-[420px] max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-notion-border">
          <h4 className="text-sm font-semibold text-notion-text">
            {group
              ? t("routineGroup.edit", "Edit Group")
              : t("routineGroup.create", "Create Group")}
          </h4>
          <button
            onClick={onClose}
            className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {/* Name */}
          <div>
            <label className="text-[11px] text-notion-text-secondary font-medium block mb-1">
              {t("routineGroup.name", "Group Name")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(
                "routineGroup.namePlaceholder",
                "e.g. Morning Routine",
              )}
              className="w-full px-2 py-1.5 text-sm bg-notion-bg-secondary border border-notion-border rounded focus:outline-none focus:ring-1 focus:ring-notion-blue text-notion-text"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
          </div>

          {/* Color */}
          <div>
            <label className="text-[11px] text-notion-text-secondary font-medium block mb-1">
              {t("routineGroup.color", "Color")}
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="w-6 h-6 rounded-md border border-notion-border"
                style={{ backgroundColor: color }}
              />
              <span className="text-[11px] text-notion-text-secondary">
                {color}
              </span>
            </div>
            {showColorPicker && (
              <div className="mt-2">
                <UnifiedColorPicker
                  color={color}
                  onChange={setColor}
                  mode="preset-only"
                  inline
                />
              </div>
            )}
          </div>

          {/* Tag assignment */}
          <RoutineGroupTagPicker
            tags={tags}
            selectedTagIds={selectedTagIds}
            onChange={setSelectedTagIds}
          />

          {/* Group slide (edit mode only) */}
          {group && groupTimeRange && onSlideGroup && (
            <div>
              <label className="text-[11px] text-notion-text-secondary font-medium block mb-1">
                {t("routineGroup.timeRange", "Time Range")}
              </label>
              <div className="flex items-center gap-2 text-sm text-notion-text">
                <input
                  type="time"
                  value={groupTimeRange.startTime}
                  onChange={(e) => handleSlide(e.target.value)}
                  className="px-1.5 py-1 bg-notion-bg-secondary border border-notion-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-notion-blue text-notion-text"
                />
                <span className="text-notion-text-secondary">-</span>
                <span className="text-notion-text-secondary">
                  {groupTimeRange.endTime}
                </span>
              </div>
              <div className="text-[10px] text-notion-text-secondary mt-1">
                {t(
                  "routineGroup.slideHint",
                  "Changing start time slides all member routines",
                )}
              </div>
              {memberRoutines.length > 0 && (
                <div className="mt-1 text-[10px] text-notion-text-secondary">
                  {memberRoutines.length}{" "}
                  {t("routineGroup.members", "routines")}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-notion-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-notion-text-secondary hover:text-notion-text rounded transition-colors"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-sm bg-notion-blue text-white rounded hover:bg-notion-blue/90 disabled:opacity-50 transition-colors"
          >
            {group ? t("common.save", "Save") : t("schedule.create", "Create")}
          </button>
        </div>
      </div>
    </div>
  );
}
