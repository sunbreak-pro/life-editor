import { Suspense } from "react";
import type { TaskNode } from "../../../types/taskTree";
import type { Priority } from "../../../types/priority";
import { TaskDetailHeader } from "./TaskDetailHeader";
import { EmptyState } from "./EmptyState";
import { LazyRichTextEditor as RichTextEditor } from "../../shared/LazyRichTextEditor";

interface TaskDetailProps {
  task: TaskNode | null;
  globalWorkDuration: number;
  onPlay: () => void;
  onDelete: () => void;
  onUpdateContent?: (content: string) => void;
  onDurationChange?: (minutes: number) => void;
  onScheduledAtChange?: (scheduledAt: string | undefined) => void;
  onScheduledEndAtChange?: (scheduledEndAt: string | undefined) => void;
  onIsAllDayChange?: (isAllDay: boolean) => void;
  onNodeIconChange?: (nodeId: string, icon: string | undefined) => void;
  onTitleChange?: (newTitle: string) => void;
  onTimeMemoChange?: (value: string | undefined) => void;
  onPriorityChange?: (priority: Priority | null) => void;
  onReminderEnabledChange?: (enabled: boolean) => void;
  onReminderOffsetChange?: (offset: number) => void;
}

export function TaskDetail({
  task,
  globalWorkDuration,
  onPlay,
  onDelete,
  onUpdateContent,
  onDurationChange,
  onScheduledAtChange,
  onScheduledEndAtChange,
  onIsAllDayChange,
  onNodeIconChange,
  onTitleChange,
  onTimeMemoChange,
  onPriorityChange,
  onReminderEnabledChange,
  onReminderOffsetChange,
}: TaskDetailProps) {
  if (!task) {
    return <EmptyState />;
  }

  return (
    <div className="h-full flex flex-col overflow-auto">
      <div className="max-w-3xl mx-auto w-full h-full flex-1">
        <TaskDetailHeader
          task={task}
          globalWorkDuration={globalWorkDuration}
          onPlay={onPlay}
          onDelete={onDelete}
          onDurationChange={onDurationChange}
          onScheduledAtChange={onScheduledAtChange}
          onScheduledEndAtChange={onScheduledEndAtChange}
          onIsAllDayChange={onIsAllDayChange}
          onNodeIconChange={onNodeIconChange}
          onTitleChange={onTitleChange}
          onTimeMemoChange={onTimeMemoChange}
          onPriorityChange={onPriorityChange}
          onReminderEnabledChange={onReminderEnabledChange}
          onReminderOffsetChange={onReminderOffsetChange}
        />
        <div className="mt-6">
          <Suspense fallback={<div className="min-h-50" />}>
            <RichTextEditor
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
