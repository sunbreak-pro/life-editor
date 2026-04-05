import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { KeyboardEvent } from "react";
import {
  Calendar,
  Trash2,
  FolderOpen,
  Folder,
  ChevronRight,
  ChevronDown,
  StickyNote,
} from "lucide-react";
import { TaskStatusIcon } from "../TaskTree/TaskStatusIcon";
import { useTranslation } from "react-i18next";
import { useTaskTreeContext } from "../../../hooks/useTaskTreeContext";
import type { TaskNode, TaskStatus } from "../../../types/taskTree";
import type {
  MoveResult,
  MoveRejectionReason,
} from "../../../types/moveResult";
import { useToast } from "../../../context/ToastContext";
import { RoleSwitcher } from "../Schedule/shared/RoleSwitcher";
import {
  useRoleConversion,
  type ConversionSource,
  type ConversionRole,
} from "../../../hooks/useRoleConversion";
import { formatDateKey } from "../../../utils/dateKey";
import { FolderTag } from "../Folder/FolderTag";
import { FolderMovePicker } from "../Folder/FolderMovePicker";
import { UnifiedColorPicker } from "../../shared/UnifiedColorPicker";
import { MiniCalendarGrid } from "../../shared/MiniCalendarGrid";
import { TaskDetailEmpty } from "./TaskDetailEmpty";
import { WikiTagList } from "../../WikiTags/WikiTagList";
import { getAncestors } from "../../../utils/breadcrumb";
import { DateTimeRangePicker } from "../Schedule/shared/DateTimeRangePicker";
import { fireTaskCompleteConfetti } from "../../../utils/confetti";
import { playEffectSound } from "../../../utils/playEffectSound";

interface TaskDetailPanelProps {
  selectedNodeId: string | null;
  onPlayTask?: (node: TaskNode) => void;
  onSelectTask?: (id: string) => void;
}

export function TaskDetailPanel({
  selectedNodeId,
  onPlayTask,
  onSelectTask,
}: TaskDetailPanelProps) {
  const {
    nodes,
    updateNode,
    moveNodeInto,
    moveToRoot,
    softDelete,
    toggleTaskStatus,
    setTaskStatus,
  } = useTaskTreeContext();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const node = selectedNodeId
    ? (nodes.find((n) => n.id === selectedNodeId) ?? null)
    : null;

  return (
    <div className="h-full flex flex-col bg-notion-bg">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-6">
          {!node ? (
            <TaskDetailEmpty />
          ) : node.type === "task" ? (
            <TaskSidebarContent
              node={node}
              nodes={nodes}
              updateNode={updateNode}
              moveNodeInto={moveNodeInto}
              moveToRoot={moveToRoot}
              softDelete={softDelete}
              onPlayTask={onPlayTask}
              onMoveRejected={(reason) => {
                if (reason === "circular_reference") {
                  showToast("warning", t("taskTree.move.circularReference"));
                }
              }}
            />
          ) : (
            <FolderSidebarContent
              node={node}
              nodes={nodes}
              updateNode={updateNode}
              onSelectTask={onSelectTask}
              toggleTaskStatus={toggleTaskStatus}
              setTaskStatus={setTaskStatus}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Task sidebar content ---

interface TaskSidebarContentProps {
  node: TaskNode;
  nodes: TaskNode[];
  updateNode: (id: string, updates: Partial<TaskNode>) => void;
  moveNodeInto: (activeId: string, targetFolderId: string) => MoveResult;
  moveToRoot: (id: string) => MoveResult;
  softDelete: (id: string) => void;
  onPlayTask?: (node: TaskNode) => void;
  onMoveRejected?: (reason: MoveRejectionReason) => void;
}

function TaskSidebarContent({
  node,
  nodes,
  updateNode,
  moveNodeInto,
  moveToRoot,
  softDelete,
  onPlayTask,
  onMoveRejected,
}: TaskSidebarContentProps) {
  const { t } = useTranslation();
  const [colorPickerAncestorId, setColorPickerAncestorId] = useState<
    string | null
  >(null);
  const ancestors = getAncestors(node.id, nodes);

  const handleMove = useCallback(
    (newFolderId: string | null) => {
      const result =
        newFolderId === null
          ? moveToRoot(node.id)
          : moveNodeInto(node.id, newFolderId);
      if (!result.success && onMoveRejected) {
        onMoveRejected(result.reason);
      }
    },
    [node.id, moveNodeInto, moveToRoot, onMoveRejected],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header section */}
      <div className="space-y-3 pb-4 border-b border-notion-border mb-4">
        {/* Row 1: Breadcrumb */}
        <div className="flex items-center gap-2 min-h-8">
          <FolderMovePicker
            currentFolderId={node.parentId}
            onMove={handleMove}
            trigger={
              <span
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded-md transition-colors cursor-pointer"
                title={t("taskDetailSidebar.moveToFolder")}
              >
                <FolderOpen size={14} />
                <span>{t("taskDetailSidebar.moveToFolder")}</span>
              </span>
            }
          />
          <div className="flex items-center gap-1.5 text-sm text-notion-text-secondary flex-1 min-w-0">
            {ancestors.length > 0 ? (
              ancestors.map((ancestor, i) => (
                <span
                  key={ancestor.id}
                  className="flex items-center gap-1 relative shrink-0"
                >
                  {i > 0 && (
                    <span className="text-notion-text-secondary/50">/</span>
                  )}
                  {ancestor.type === "folder" ? (
                    <>
                      <button
                        onClick={() =>
                          setColorPickerAncestorId(
                            colorPickerAncestorId === ancestor.id
                              ? null
                              : ancestor.id,
                          )
                        }
                        className="hover:text-notion-text transition-colors cursor-pointer"
                      >
                        <FolderTag
                          tag={ancestor.title}
                          color={ancestor.color}
                          compact
                        />
                      </button>
                      {colorPickerAncestorId === ancestor.id && (
                        <UnifiedColorPicker
                          color={ancestor.color ?? ""}
                          onChange={(color) =>
                            updateNode(ancestor.id, { color })
                          }
                          onClose={() => setColorPickerAncestorId(null)}
                        />
                      )}
                    </>
                  ) : (
                    <span>{ancestor.title}</span>
                  )}
                </span>
              ))
            ) : (
              <span className="text-notion-text-secondary/50">
                {t("folderFilter.all")}
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Title */}
        <EditableTitle
          key={node.id}
          value={node.title}
          onSave={(title) => updateNode(node.id, { title })}
        />

        {/* Row 3: WikiTags */}
        <WikiTagList entityId={node.id} entityType="task" />

        {/* Row 3.5: Role Switcher */}
        <TaskRoleSwitcherRow node={node} />

        {/* Row 4: Actions */}
        <div className="flex items-center gap-2">
          <DateTimeRangePicker
            startValue={node.scheduledAt}
            endValue={node.scheduledEndAt}
            isAllDay={node.isAllDay}
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

          {node.scheduledAt && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-notion-border">
              <StickyNote
                size={12}
                className="text-notion-text-secondary shrink-0"
              />
              <input
                type="text"
                value={node.timeMemo ?? ""}
                onChange={(e) =>
                  updateNode(node.id, { timeMemo: e.target.value || undefined })
                }
                placeholder={t("taskDetail.timeMemo")}
                className="text-xs bg-transparent outline-none text-notion-text placeholder:text-notion-text-secondary/50 w-24"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <button
            onClick={() => softDelete(node.id)}
            className="px-2 py-1 rounded-md text-notion-text-secondary hover:text-notion-danger hover:bg-notion-hover transition-colors ml-auto"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Folder sidebar content ---

interface FolderSidebarContentProps {
  node: TaskNode;
  nodes: TaskNode[];
  updateNode: (id: string, updates: Partial<TaskNode>) => void;
  onSelectTask?: (id: string) => void;
  toggleTaskStatus: (id: string) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
}

function FolderSidebarContent({
  node,
  nodes,
  updateNode,
  onSelectTask,
  toggleTaskStatus,
  setTaskStatus,
}: FolderSidebarContentProps) {
  const { t } = useTranslation();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSchedule, setShowSchedule] = useState(node.scheduledAt != null);
  const [prevNodeId, setPrevNodeId] = useState(node.id);
  const [colorPickerAncestorId, setColorPickerAncestorId] = useState<
    string | null
  >(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );

  if (prevNodeId !== node.id) {
    setPrevNodeId(node.id);
    setShowSchedule(node.scheduledAt != null);
    setExpandedFolders(new Set());
  }

  const ancestors = getAncestors(node.id, nodes);

  const children = useMemo(
    () =>
      nodes.filter(
        (n) => n.parentId === node.id && !n.isDeleted && n.status !== "DONE",
      ),
    [nodes, node.id],
  );
  const childFolders = useMemo(
    () => children.filter((n) => n.type === "folder"),
    [children],
  );
  const childTasks = useMemo(
    () => children.filter((n) => n.type === "task"),
    [children],
  );

  const getGrandchildren = useCallback(
    (folderId: string) =>
      nodes.filter(
        (n) => n.parentId === folderId && !n.isDeleted && n.status !== "DONE",
      ),
    [nodes],
  );

  const getChildCount = useCallback(
    (folderId: string) =>
      nodes.filter(
        (n) => n.parentId === folderId && !n.isDeleted && n.status !== "DONE",
      ).length,
    [nodes],
  );

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleToggleTaskStatus = useCallback(
    (taskId: string) => {
      const target = nodes.find((n) => n.id === taskId);
      if (target && target.status === "IN_PROGRESS") {
        fireTaskCompleteConfetti();
        playEffectSound("/sounds/task_complete_sound.mp3", "taskComplete");
      }
      toggleTaskStatus(taskId);
    },
    [nodes, toggleTaskStatus],
  );

  const handleSetTaskStatus = useCallback(
    (taskId: string, newStatus: TaskStatus) => {
      const target = nodes.find((n) => n.id === taskId);
      if (target && newStatus === "DONE" && target.status === "IN_PROGRESS") {
        fireTaskCompleteConfetti();
        playEffectSound("/sounds/task_complete_sound.mp3", "taskComplete");
      }
      setTaskStatus(taskId, newStatus);
    },
    [nodes, setTaskStatus],
  );

  return (
    <div className="space-y-4">
      {/* Breadcrumb path */}
      <div className="flex items-center gap-1.5 text-sm text-notion-text-secondary min-h-6">
        {ancestors.length > 0 ? (
          ancestors.map((ancestor, i) => (
            <span
              key={ancestor.id}
              className="flex items-center gap-1 relative shrink-0"
            >
              {i > 0 && (
                <span className="text-notion-text-secondary/50">/</span>
              )}
              {ancestor.type === "folder" ? (
                <>
                  <button
                    onClick={() =>
                      setColorPickerAncestorId(
                        colorPickerAncestorId === ancestor.id
                          ? null
                          : ancestor.id,
                      )
                    }
                    className="hover:text-notion-text transition-colors cursor-pointer"
                  >
                    <FolderTag
                      tag={ancestor.title}
                      color={ancestor.color}
                      compact
                    />
                  </button>
                  {colorPickerAncestorId === ancestor.id && (
                    <UnifiedColorPicker
                      color={ancestor.color ?? ""}
                      onChange={(color) => updateNode(ancestor.id, { color })}
                      onClose={() => setColorPickerAncestorId(null)}
                    />
                  )}
                </>
              ) : (
                <span>{ancestor.title}</span>
              )}
            </span>
          ))
        ) : (
          <span className="text-notion-text-secondary/50">
            {t("folderFilter.all")}
          </span>
        )}
      </div>

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
          <UnifiedColorPicker
            color={node.color ?? ""}
            onChange={(color) => updateNode(node.id, { color })}
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

      {/* Folder contents */}
      {(childFolders.length > 0 || childTasks.length > 0) && (
        <div className="pt-2 border-t border-notion-border">
          <p className="text-xs font-medium text-notion-text-secondary mb-2">
            {t("folderContents.title")}
          </p>

          {/* Child folders */}
          {childFolders.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] uppercase tracking-wider text-notion-text-secondary/60 mb-1">
                {t("folderContents.folders")}
              </p>
              <div className="space-y-0.5">
                {childFolders.map((folder) => {
                  const isExpanded = expandedFolders.has(folder.id);
                  const count = getChildCount(folder.id);
                  return (
                    <div key={folder.id}>
                      <div className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-sm text-notion-text hover:bg-notion-hover transition-colors">
                        <button
                          onClick={() => toggleFolder(folder.id)}
                          className="shrink-0 text-notion-text-secondary hover:text-notion-text"
                        >
                          {isExpanded ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </button>
                        <button
                          onClick={() => onSelectTask?.(folder.id)}
                          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                        >
                          <Folder
                            size={14}
                            className="shrink-0"
                            style={{ color: folder.color ?? "#9CA3AF" }}
                          />
                          <span className="truncate flex-1">
                            {folder.title}
                          </span>
                          <span className="text-[10px] text-notion-text-secondary/60 shrink-0">
                            {count} {count === 1 ? "item" : "items"}
                          </span>
                        </button>
                      </div>

                      {/* Grandchildren (2nd level) */}
                      {isExpanded && (
                        <div className="ml-5 space-y-0.5 mt-0.5">
                          {getGrandchildren(folder.id).map((grandchild) => (
                            <div
                              key={grandchild.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => onSelectTask?.(grandchild.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ")
                                  onSelectTask?.(grandchild.id);
                              }}
                              className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-sm text-notion-text hover:bg-notion-hover transition-colors text-left cursor-pointer"
                            >
                              {grandchild.type === "folder" ? (
                                <Folder
                                  size={13}
                                  className="shrink-0"
                                  style={{
                                    color: grandchild.color ?? "#9CA3AF",
                                  }}
                                />
                              ) : (
                                <TaskStatusIcon
                                  status={
                                    (grandchild.status as
                                      | "NOT_STARTED"
                                      | "IN_PROGRESS"
                                      | "DONE") ?? "NOT_STARTED"
                                  }
                                  onClick={() =>
                                    handleToggleTaskStatus(grandchild.id)
                                  }
                                  onSetStatus={(s) =>
                                    handleSetTaskStatus(grandchild.id, s)
                                  }
                                />
                              )}
                              <span className="truncate">
                                {grandchild.title}
                              </span>
                            </div>
                          ))}
                          {getGrandchildren(folder.id).length === 0 && (
                            <p className="text-xs text-notion-text-secondary/50 px-2 py-1">
                              {t("folderContents.empty")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Child tasks */}
          {childTasks.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-notion-text-secondary/60 mb-1">
                {t("folderContents.tasks")}
              </p>
              <div className="space-y-0.5">
                {childTasks.map((task) => (
                  <div
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectTask?.(task.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        onSelectTask?.(task.id);
                    }}
                    className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-sm text-notion-text hover:bg-notion-hover transition-colors text-left cursor-pointer"
                  >
                    <TaskStatusIcon
                      status={
                        (task.status as
                          | "NOT_STARTED"
                          | "IN_PROGRESS"
                          | "DONE") ?? "NOT_STARTED"
                      }
                      onClick={() => handleToggleTaskStatus(task.id)}
                      onSetStatus={(s) => handleSetTaskStatus(task.id, s)}
                    />
                    <span className="truncate">{task.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
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
      className="text-lg font-bold text-notion-text cursor-pointer hover:bg-notion-hover/50 rounded px-1 -mx-1 transition-colors wrap-break-words"
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

function TaskRoleSwitcherRow({ node }: { node: TaskNode }) {
  const { convert, canConvert } = useRoleConversion();
  const date = node.scheduledAt
    ? formatDateKey(new Date(node.scheduledAt))
    : formatDateKey(new Date());
  const source: ConversionSource = { role: "task", task: node, date };
  const roles: ConversionRole[] = ["task", "event", "note", "daily"];
  const disabledRoles = roles.filter((r) => !canConvert(source, r));

  return (
    <RoleSwitcher
      currentRole="task"
      disabledRoles={disabledRoles}
      onSelectRole={(targetRole) => convert(source, targetRole)}
    />
  );
}
