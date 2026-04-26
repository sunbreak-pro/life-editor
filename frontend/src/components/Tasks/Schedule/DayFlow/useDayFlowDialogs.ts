import { useCallback, useState } from "react";
import type { RoutineNode } from "../../../../types/routine";
import type { RoutineGroup } from "../../../../types/routineGroup";
import type { ScheduleItem } from "../../../../types/schedule";
import type { TaskNode } from "../../../../types/taskTree";
import type { PanelTab } from "../../../shared/TaskSchedulePanel";

export interface DayFlowDialogsResult {
  editRoutineDialog: RoutineNode | null;
  setEditRoutineDialog: React.Dispatch<
    React.SetStateAction<RoutineNode | null>
  >;
  editGroupDialog: RoutineGroup | null;
  setEditGroupDialog: React.Dispatch<React.SetStateAction<RoutineGroup | null>>;
  allDayTaskPreview: {
    task: TaskNode;
    position: { x: number; y: number };
  } | null;
  setAllDayTaskPreview: React.Dispatch<
    React.SetStateAction<{
      task: TaskNode;
      position: { x: number; y: number };
    } | null>
  >;
  allDaySchedulePreview: {
    item: ScheduleItem;
    position: { x: number; y: number };
  } | null;
  setAllDaySchedulePreview: React.Dispatch<
    React.SetStateAction<{
      item: ScheduleItem;
      position: { x: number; y: number };
    } | null>
  >;
  clickMenu: {
    startTime: string;
    endTime: string;
    position: { x: number; y: number };
  } | null;
  setClickMenu: React.Dispatch<
    React.SetStateAction<{
      startTime: string;
      endTime: string;
      position: { x: number; y: number };
    } | null>
  >;
  createPopover: {
    startTime: string;
    endTime: string;
    position: { x: number; y: number };
    defaultTab?: PanelTab;
  } | null;
  setCreatePopover: React.Dispatch<
    React.SetStateAction<{
      startTime: string;
      endTime: string;
      position: { x: number; y: number };
      defaultTab?: PanelTab;
    } | null>
  >;
  routineDeleteTarget: {
    item: ScheduleItem;
    position: { x: number; y: number };
  } | null;
  setRoutineDeleteTarget: React.Dispatch<
    React.SetStateAction<{
      item: ScheduleItem;
      position: { x: number; y: number };
    } | null>
  >;
  routineTimeChange: {
    itemId: string;
    routineId: string;
    routineTitle: string;
    startTime: string;
    endTime: string;
    prevStartTime: string;
    prevEndTime: string;
  } | null;
  setRoutineTimeChange: React.Dispatch<
    React.SetStateAction<{
      itemId: string;
      routineId: string;
      routineTitle: string;
      startTime: string;
      endTime: string;
      prevStartTime: string;
      prevEndTime: string;
    } | null>
  >;
  routinePicker: {
    startTime: string;
    endTime: string;
    position: { x: number; y: number };
  } | null;
  setRoutinePicker: React.Dispatch<
    React.SetStateAction<{
      startTime: string;
      endTime: string;
      position: { x: number; y: number };
    } | null>
  >;
  notePicker: {
    startTime: string;
    endTime: string;
    position: { x: number; y: number };
  } | null;
  setNotePicker: React.Dispatch<
    React.SetStateAction<{
      startTime: string;
      endTime: string;
      position: { x: number; y: number };
    } | null>
  >;
  handleRequestRoutineDelete: (
    item: ScheduleItem,
    position: { x: number; y: number },
  ) => void;
  handleDismissOnly: () => void;
  handleArchiveRoutine: () => void;
}

export function useDayFlowDialogs(deps: {
  dismissScheduleItem: (id: string) => void;
  updateRoutine: (id: string, updates: { isArchived?: boolean }) => void;
  softDeleteScheduleItem: (id: string) => void;
}): DayFlowDialogsResult {
  const { dismissScheduleItem, updateRoutine, softDeleteScheduleItem } = deps;

  const [editRoutineDialog, setEditRoutineDialog] =
    useState<RoutineNode | null>(null);
  const [editGroupDialog, setEditGroupDialog] = useState<RoutineGroup | null>(
    null,
  );
  const [allDayTaskPreview, setAllDayTaskPreview] = useState<{
    task: TaskNode;
    position: { x: number; y: number };
  } | null>(null);
  const [allDaySchedulePreview, setAllDaySchedulePreview] = useState<{
    item: ScheduleItem;
    position: { x: number; y: number };
  } | null>(null);
  const [clickMenu, setClickMenu] = useState<{
    startTime: string;
    endTime: string;
    position: { x: number; y: number };
  } | null>(null);
  const [createPopover, setCreatePopover] = useState<{
    startTime: string;
    endTime: string;
    position: { x: number; y: number };
    defaultTab?: PanelTab;
  } | null>(null);
  const [routineDeleteTarget, setRoutineDeleteTarget] = useState<{
    item: ScheduleItem;
    position: { x: number; y: number };
  } | null>(null);
  const [routineTimeChange, setRoutineTimeChange] = useState<{
    itemId: string;
    routineId: string;
    routineTitle: string;
    startTime: string;
    endTime: string;
    prevStartTime: string;
    prevEndTime: string;
  } | null>(null);
  const [routinePicker, setRoutinePicker] = useState<{
    startTime: string;
    endTime: string;
    position: { x: number; y: number };
  } | null>(null);
  const [notePicker, setNotePicker] = useState<{
    startTime: string;
    endTime: string;
    position: { x: number; y: number };
  } | null>(null);

  const handleRequestRoutineDelete = useCallback(
    (item: ScheduleItem, position: { x: number; y: number }) => {
      setRoutineDeleteTarget({ item, position });
    },
    [],
  );

  const handleDismissOnly = useCallback(() => {
    if (!routineDeleteTarget) return;
    dismissScheduleItem(routineDeleteTarget.item.id);
    setRoutineDeleteTarget(null);
  }, [routineDeleteTarget, dismissScheduleItem]);

  const handleArchiveRoutine = useCallback(() => {
    if (!routineDeleteTarget?.item.routineId) return;
    updateRoutine(routineDeleteTarget.item.routineId, { isArchived: true });
    softDeleteScheduleItem(routineDeleteTarget.item.id);
    setRoutineDeleteTarget(null);
  }, [routineDeleteTarget, updateRoutine, softDeleteScheduleItem]);

  return {
    editRoutineDialog,
    setEditRoutineDialog,
    editGroupDialog,
    setEditGroupDialog,
    allDayTaskPreview,
    setAllDayTaskPreview,
    allDaySchedulePreview,
    setAllDaySchedulePreview,
    clickMenu,
    setClickMenu,
    createPopover,
    setCreatePopover,
    routineDeleteTarget,
    setRoutineDeleteTarget,
    routineTimeChange,
    setRoutineTimeChange,
    routinePicker,
    setRoutinePicker,
    notePicker,
    setNotePicker,
    handleRequestRoutineDelete,
    handleDismissOnly,
    handleArchiveRoutine,
  };
}
