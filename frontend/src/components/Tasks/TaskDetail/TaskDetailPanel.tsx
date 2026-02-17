import { useState, useEffect, useRef, useCallback } from "react";
import type { KeyboardEvent } from "react";
import { Play, Clock, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTaskTreeContext } from "../../../hooks/useTaskTreeContext";
import { useTimerContext } from "../../../hooks/useTimerContext";
import type { TaskNode } from "../../../types/taskTree";
import { FolderTag } from "../Folder/FolderTag";
import { FolderMovePicker } from "../Folder/FolderMovePicker";
import { ColorPicker } from "../../shared/ColorPicker";
import { DurationPicker } from "../../shared/DurationPicker";
import { MiniCalendarGrid } from "../../shared/MiniCalendarGrid";
import { formatDuration } from "../../../utils/duration";
import { TaskDetailEmpty } from "./TaskDetailEmpty";

interface TaskDetailPanelProps {
  selectedNodeId: string | null;
  onPlayTask?: (node: TaskNode) => void;
}

export function TaskDetailPanel({
  selectedNodeId,
  onPlayTask,
}: TaskDetailPanelProps) {
  const {
    nodes,
    updateNode,
    getTaskColor,
    getFolderTagForTask,
    moveNodeInto,
    moveToRoot,
  } = useTaskTreeContext();
  const timer = useTimerContext();

  const node = selectedNodeId
    ? (nodes.find((n) => n.id === selectedNodeId) ?? null)
    : null;

  return (
    <div className="h-full flex flex-col bg-notion-bg">
      <div className="flex-1 overflow-y-auto p-4">
        {!node ? (
          <TaskDetailEmpty />
        ) : node.type === "task" ? (
          <TaskSidebarContent
            node={node}
            updateNode={updateNode}
            getTaskColor={getTaskColor}
            getFolderTagForTask={getFolderTagForTask}
            moveNodeInto={moveNodeInto}
            moveToRoot={moveToRoot}
            onPlayTask={onPlayTask}
            globalWorkDuration={timer.workDurationMinutes}
          />
        ) : (
          <FolderSidebarContent node={node} updateNode={updateNode} />
        )}
      </div>
    </div>
  );
}

// --- Task sidebar content ---

interface TaskSidebarContentProps {
  node: TaskNode;
  updateNode: (id: string, updates: Partial<TaskNode>) => void;
  getTaskColor: (taskId: string) => string | undefined;
  getFolderTagForTask: (taskId: string) => string | undefined;
  moveNodeInto: (activeId: string, targetFolderId: string) => void;
  moveToRoot: (id: string) => void;
  onPlayTask?: (node: TaskNode) => void;
  globalWorkDuration: number;
}

function TaskSidebarContent({
  node,
  updateNode,
  getTaskColor,
  getFolderTagForTask,
  moveNodeInto,
  moveToRoot,
  onPlayTask,
  globalWorkDuration,
}: TaskSidebarContentProps) {
  const { t } = useTranslation();
  const folderTag = getFolderTagForTask(node.id);
  const taskColor = getTaskColor(node.id);
  const duration = node.workDurationMinutes ?? globalWorkDuration;
  const isCustomDuration = node.workDurationMinutes != null;
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showWork, setShowWork] = useState(node.workDurationMinutes != null);
  const [showSchedule, setShowSchedule] = useState(node.scheduledAt != null);
  const [prevNodeId, setPrevNodeId] = useState(node.id);

  if (prevNodeId !== node.id) {
    setPrevNodeId(node.id);
    setShowWork(node.workDurationMinutes != null);
    setShowSchedule(node.scheduledAt != null);
  }

  const handleMove = useCallback(
    (newFolderId: string | null) => {
      if (newFolderId === null) {
        moveToRoot(node.id);
      } else {
        moveNodeInto(node.id, newFolderId);
      }
    },
    [node.id, moveNodeInto, moveToRoot],
  );

  return (
    <div className="space-y-4">
      {/* Title */}
      <EditableTitle
        key={node.id}
        value={node.title}
        onSave={(title) => updateNode(node.id, { title })}
      />

      {/* Folder tag + move */}
      {folderTag && (
        <FolderMovePicker
          currentFolderId={node.parentId}
          onMove={handleMove}
          trigger={<FolderTag tag={folderTag} color={taskColor} />}
        />
      )}
      {!folderTag && (
        <FolderMovePicker
          currentFolderId={node.parentId}
          onMove={handleMove}
          trigger={
            <span className="text-xs text-notion-text-secondary hover:text-notion-text cursor-pointer">
              {t("taskTree.inbox")}
            </span>
          }
        />
      )}

      {/* Folder color picker */}
      {node.parentId && (
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="text-xs text-notion-text-secondary hover:text-notion-text transition-colors"
          >
            {t("taskDetailSidebar.folderColor")}
          </button>
          {showColorPicker && (
            <ColorPicker
              currentColor={taskColor}
              onSelect={(color) => {
                if (node.parentId) updateNode(node.parentId, { color });
              }}
              onClose={() => setShowColorPicker(false)}
            />
          )}
        </div>
      )}

      {/* Toggle buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowWork(!showWork)}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
            showWork
              ? "text-notion-accent bg-notion-accent/10"
              : "text-notion-text-secondary hover:bg-notion-hover"
          }`}
        >
          <Play size={12} />
          <span>Work</span>
        </button>
        <button
          onClick={() => setShowSchedule(!showSchedule)}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
            showSchedule
              ? "text-notion-accent bg-notion-accent/10"
              : "text-notion-text-secondary hover:bg-notion-hover"
          }`}
        >
          <Calendar size={12} />
          <span>Schedule</span>
        </button>
      </div>

      {/* Play + Duration */}
      {showWork && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPlayTask?.(node)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-notion-accent text-white hover:opacity-90 transition-opacity"
          >
            <Play size={14} />
            <span>{t("taskDetail.start")}</span>
          </button>
          <div className="relative">
            <button
              onClick={() => setShowDurationPicker(!showDurationPicker)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
                isCustomDuration
                  ? "text-notion-accent bg-notion-accent/10"
                  : "text-notion-text-secondary hover:bg-notion-hover"
              }`}
            >
              <Clock size={12} />
              <span>{formatDuration(duration)}</span>
            </button>
            {showDurationPicker && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-notion-bg border border-notion-border rounded-lg shadow-lg p-3 w-52">
                <DurationPicker
                  value={duration}
                  onChange={(min) => {
                    updateNode(node.id, {
                      workDurationMinutes: min === 0 ? undefined : min,
                    });
                  }}
                  showResetToDefault={isCustomDuration}
                  onResetToDefault={() => {
                    updateNode(node.id, { workDurationMinutes: undefined });
                    setShowDurationPicker(false);
                  }}
                  defaultLabel={t("taskDetail.useGlobalDefault", {
                    min: globalWorkDuration,
                  })}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calendar */}
      {showSchedule && (
        <div>
          <MiniCalendarGrid
            startValue={node.scheduledAt}
            endValue={node.scheduledEndAt}
            isAllDay={node.isAllDay}
            controlsPosition="right"
            onStartChange={(val) => {
              if (val === undefined) {
                updateNode(node.id, {
                  scheduledAt: undefined,
                  scheduledEndAt: undefined,
                  isAllDay: undefined,
                });
              } else {
                updateNode(node.id, { scheduledAt: val });
              }
            }}
            onEndChange={(val) => updateNode(node.id, { scheduledEndAt: val })}
            onAllDayChange={(val) => {
              if (val) {
                updateNode(node.id, {
                  isAllDay: true,
                  scheduledEndAt: undefined,
                });
              } else {
                updateNode(node.id, { isAllDay: undefined });
              }
            }}
          />
        </div>
      )}

      {/* Memo textarea */}
      <div>
        <p className="text-xs font-medium text-notion-text-secondary mb-1">
          {t("taskDetailSidebar.memo")}
        </p>
        <DebouncedTextarea
          key={node.id}
          initialValue={node.content ?? ""}
          onSave={(content) => updateNode(node.id, { content })}
          placeholder={t("taskDetailSidebar.memoPlaceholder")}
        />
      </div>
    </div>
  );
}

// --- Folder sidebar content ---

interface FolderSidebarContentProps {
  node: TaskNode;
  updateNode: (id: string, updates: Partial<TaskNode>) => void;
}

function FolderSidebarContent({ node, updateNode }: FolderSidebarContentProps) {
  const { t } = useTranslation();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSchedule, setShowSchedule] = useState(node.scheduledAt != null);
  const [prevNodeId, setPrevNodeId] = useState(node.id);

  if (prevNodeId !== node.id) {
    setPrevNodeId(node.id);
    setShowSchedule(node.scheduledAt != null);
  }

  return (
    <div className="space-y-4">
      {/* Title */}
      <EditableTitle
        key={node.id}
        value={node.title}
        onSave={(title) => updateNode(node.id, { title })}
      />

      {/* Color picker */}
      <div className="relative">
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="flex items-center gap-2"
        >
          <div
            className="w-5 h-5 rounded-full border border-notion-border"
            style={{ backgroundColor: node.color ?? "#E5E7EB" }}
          />
          <span className="text-xs text-notion-text-secondary">
            {t("taskDetailSidebar.folderColor")}
          </span>
        </button>
        {showColorPicker && (
          <ColorPicker
            currentColor={node.color}
            onSelect={(color) => updateNode(node.id, { color })}
            onClose={() => setShowColorPicker(false)}
          />
        )}
      </div>

      {/* Schedule toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowSchedule(!showSchedule)}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
            showSchedule
              ? "text-notion-accent bg-notion-accent/10"
              : "text-notion-text-secondary hover:bg-notion-hover"
          }`}
        >
          <Calendar size={12} />
          <span>Schedule</span>
        </button>
      </div>

      {/* Calendar */}
      {showSchedule && (
        <div>
          <MiniCalendarGrid
            startValue={node.scheduledAt}
            endValue={node.scheduledEndAt}
            isAllDay={node.isAllDay}
            controlsPosition="right"
            onStartChange={(val) => {
              if (val === undefined) {
                updateNode(node.id, {
                  scheduledAt: undefined,
                  scheduledEndAt: undefined,
                  isAllDay: undefined,
                });
              } else {
                updateNode(node.id, { scheduledAt: val });
              }
            }}
            onEndChange={(val) => updateNode(node.id, { scheduledEndAt: val })}
            onAllDayChange={(val) => {
              if (val) {
                updateNode(node.id, {
                  isAllDay: true,
                  scheduledEndAt: undefined,
                });
              } else {
                updateNode(node.id, { isAllDay: undefined });
              }
            }}
          />
        </div>
      )}

      {/* Memo textarea */}
      <div>
        <p className="text-xs font-medium text-notion-text-secondary mb-1">
          {t("taskDetailSidebar.memo")}
        </p>
        <DebouncedTextarea
          key={node.id}
          initialValue={node.content ?? ""}
          onSave={(content) => updateNode(node.id, { content })}
          placeholder={t("taskDetailSidebar.memoPlaceholder")}
        />
      </div>
    </div>
  );
}

// --- Editable title ---

function EditableTitle({
  value,
  onSave,
}: {
  value: string;
  onSave: (title: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setEditValue(value);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        maxLength={255}
        className="text-lg font-bold bg-transparent outline-none border-b border-notion-accent w-full text-notion-text"
      />
    );
  }

  return (
    <h2
      className="text-lg font-bold text-notion-text cursor-pointer hover:bg-notion-hover/50 rounded px-1 -mx-1 transition-colors break-words"
      onClick={() => setIsEditing(true)}
    >
      {value}
    </h2>
  );
}

// --- Debounced textarea ---

function DebouncedTextarea({
  initialValue,
  onSave,
  placeholder,
}: {
  initialValue: string;
  onSave: (value: string) => void;
  placeholder?: string;
}) {
  const [localValue, setLocalValue] = useState(initialValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef(localValue);

  useEffect(() => {
    setLocalValue(initialValue);
    latestValueRef.current = initialValue;
  }, [initialValue]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        // Flush on unmount
        if (latestValueRef.current !== initialValue) {
          onSave(latestValueRef.current);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (val: string) => {
    setLocalValue(val);
    latestValueRef.current = val;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSave(val);
    }, 500);
  };

  return (
    <textarea
      value={localValue}
      onChange={(e) => handleChange(e.target.value)}
      onKeyDown={(e) => e.stopPropagation()}
      placeholder={placeholder}
      className="w-full min-h-24 text-sm bg-notion-bg-secondary border border-notion-border rounded-lg p-2 text-notion-text placeholder:text-notion-text-secondary/50 resize-y outline-none focus:border-notion-accent/50 transition-colors"
    />
  );
}
