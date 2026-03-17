import { Suspense } from "react";
import type { TaskNode } from "../../../types/taskTree";
import { TaskDetailHeader } from "./TaskDetailHeader";
import { EmptyState } from "./EmptyState";
import { LazyMemoEditor as MemoEditor } from "./LazyMemoEditor";

interface TaskDetailProps {
  task: TaskNode | null;
  allNodes: TaskNode[];
  globalWorkDuration: number;
  onPlay: () => void;
  onDelete: () => void;
  onUpdateContent?: (content: string) => void;
  onDurationChange?: (minutes: number) => void;
  onScheduledAtChange?: (scheduledAt: string | undefined) => void;
  onScheduledEndAtChange?: (scheduledEndAt: string | undefined) => void;
  onIsAllDayChange?: (isAllDay: boolean) => void;
  onFolderColorChange?: (folderId: string, color: string) => void;
  onTitleChange?: (newTitle: string) => void;
  onTimeMemoChange?: (value: string | undefined) => void;
  folderTag?: string;
  taskColor?: string;
}

export function TaskDetail({
  task,
  allNodes,
  globalWorkDuration,
  onPlay,
  onDelete,
  onUpdateContent,
  onDurationChange,
  onScheduledAtChange,
  onScheduledEndAtChange,
  onIsAllDayChange,
  onFolderColorChange,
  onTitleChange,
  onTimeMemoChange,
  folderTag,
  taskColor,
}: TaskDetailProps) {
  if (!task) {
    return <EmptyState />;
  }

  return (
    <div className="h-full flex flex-col overflow-auto">
      <div className="max-w-3xl mx-auto w-full h-full flex-1">
        <TaskDetailHeader
          task={task}
          allNodes={allNodes}
          globalWorkDuration={globalWorkDuration}
          onPlay={onPlay}
          onDelete={onDelete}
          onDurationChange={onDurationChange}
          onScheduledAtChange={onScheduledAtChange}
          onScheduledEndAtChange={onScheduledEndAtChange}
          onIsAllDayChange={onIsAllDayChange}
          onFolderColorChange={onFolderColorChange}
          onTitleChange={onTitleChange}
          onTimeMemoChange={onTimeMemoChange}
          folderTag={folderTag}
          taskColor={taskColor}
        />
        <div className="mt-6">
          <Suspense fallback={<div className="min-h-50" />}>
            <MemoEditor
              key={task.id}
              taskId={task.id}
              initialContent={task.content}
              onUpdate={(content) => onUpdateContent?.(content)}
              entityType="task"
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
