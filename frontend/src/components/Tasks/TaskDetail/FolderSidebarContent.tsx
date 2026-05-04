import { useCallback, useMemo, useRef, useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconPicker } from "../../common/IconPicker";
import { MiniCalendarGrid } from "../../shared/MiniCalendarGrid";
import { TaskStatusIcon } from "../TaskTree/TaskStatusIcon";
import type { TaskNode, TaskStatus } from "../../../types/taskTree";
import { getAncestors } from "../../../utils/breadcrumb";
import { fireTaskCompleteConfetti } from "../../../utils/confetti";
import { renderIcon } from "../../../utils/iconRenderer";
import { playEffectSound } from "../../../utils/playEffectSound";
import { DebouncedTextarea } from "./DebouncedTextarea";
import { InlineEditableHeading } from "./InlineEditableHeading";

interface FolderSidebarContentProps {
  node: TaskNode;
  nodes: TaskNode[];
  updateNode: (id: string, updates: Partial<TaskNode>) => void;
  onSelectTask?: (id: string) => void;
  toggleTaskStatus: (id: string) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
}

export function FolderSidebarContent({
  node,
  nodes,
  updateNode,
  onSelectTask,
  toggleTaskStatus,
  setTaskStatus,
}: FolderSidebarContentProps) {
  const { t } = useTranslation();
  const [showIconPicker, setShowIconPicker] = useState(false);
  const folderIconRef = useRef<HTMLButtonElement>(null);
  const [showSchedule, setShowSchedule] = useState(node.scheduledAt != null);
  const [prevNodeId, setPrevNodeId] = useState(node.id);
  const [iconPickerAncestorId, setIconPickerAncestorId] = useState<
    string | null
  >(null);
  const ancestorIconRef = useRef<HTMLButtonElement>(null);
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
      nodes.filter((n) => {
        if (n.parentId !== node.id || n.isDeleted) return false;
        // For Complete folders, show all DONE children
        if (node.folderType === "complete") return true;
        return n.status !== "DONE" || n.folderType === "complete";
      }),
    [nodes, node.id, node.folderType],
  );
  const childFolders = useMemo(
    () =>
      children
        .filter((n) => n.type === "folder" && n.folderType !== "complete")
        .sort((a, b) => a.order - b.order),
    [children],
  );
  const completeFolders = useMemo(
    () => children.filter((n) => n.folderType === "complete"),
    [children],
  );
  const childTasks = useMemo(
    () => children.filter((n) => n.type === "task"),
    [children],
  );

  const getGrandchildren = useCallback(
    (folderId: string) => {
      const folder = nodes.find((n) => n.id === folderId);
      // For Complete folders, show DONE tasks inside
      if (folder?.folderType === "complete") {
        return nodes.filter((n) => n.parentId === folderId && !n.isDeleted);
      }
      return nodes.filter(
        (n) =>
          n.parentId === folderId &&
          !n.isDeleted &&
          (n.status !== "DONE" || n.folderType === "complete"),
      );
    },
    [nodes],
  );

  const getChildCount = useCallback(
    (folderId: string) => {
      const folder = nodes.find((n) => n.id === folderId);
      if (folder?.folderType === "complete") {
        return nodes.filter((n) => n.parentId === folderId && !n.isDeleted)
          .length;
      }
      return nodes.filter(
        (n) => n.parentId === folderId && !n.isDeleted && n.status !== "DONE",
      ).length;
    },
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
      <div className="flex items-center gap-1 text-sm text-notion-text-secondary min-h-6 overflow-x-auto">
        {ancestors.length > 0 ? (
          ancestors.map((ancestor, i) => (
            <div key={ancestor.id} className="flex items-center gap-1 shrink-0">
              {i > 0 && (
                <ChevronRight
                  size={12}
                  className="text-notion-text-secondary"
                />
              )}
              <button
                ref={
                  iconPickerAncestorId === ancestor.id
                    ? ancestorIconRef
                    : undefined
                }
                onClick={(e) => {
                  e.stopPropagation();
                  setIconPickerAncestorId(
                    iconPickerAncestorId === ancestor.id ? null : ancestor.id,
                  );
                }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-notion-hover transition-colors"
              >
                {ancestor.icon ? (
                  renderIcon(ancestor.icon, { size: 13 })
                ) : (
                  <Folder size={13} />
                )}
                <span className="text-xs">{ancestor.title}</span>
              </button>
              {iconPickerAncestorId === ancestor.id && (
                <IconPicker
                  value={ancestor.icon}
                  onSelect={(iconName) => {
                    updateNode(ancestor.id, { icon: iconName });
                    setIconPickerAncestorId(null);
                  }}
                  onClose={() => setIconPickerAncestorId(null)}
                  anchorRect={ancestorIconRef.current?.getBoundingClientRect()}
                  onRemove={() => {
                    updateNode(ancestor.id, { icon: undefined });
                    setIconPickerAncestorId(null);
                  }}
                />
              )}
            </div>
          ))
        ) : (
          <span className="text-notion-text-secondary/50">
            {t("folderFilter.all")}
          </span>
        )}
      </div>

      {/* Title with inline icon picker */}
      {node.folderType === "complete" ? (
        <div className="flex items-center gap-2">
          <FolderCheck size={20} className="shrink-0 text-green-500" />
          <h2 className="text-lg font-bold text-notion-text">
            {t("taskTree.completeFolder")}
          </h2>
        </div>
      ) : (
        <div className="flex items-center gap-2 relative">
          <button
            ref={folderIconRef}
            onClick={() => setShowIconPicker(!showIconPicker)}
            className="shrink-0 flex items-center justify-center hover:bg-notion-hover rounded p-1 transition-colors"
            title={t("taskDetailSidebar.folderIcon")}
          >
            {node.icon ? (
              renderIcon(node.icon, { size: 20 })
            ) : (
              <Folder size={20} className="text-notion-text-secondary" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <InlineEditableHeading
              key={node.id}
              value={node.title}
              onSave={(title) => updateNode(node.id, { title })}
            />
          </div>
          {showIconPicker && (
            <IconPicker
              value={node.icon}
              onSelect={(iconName) => {
                updateNode(node.id, { icon: iconName });
                setShowIconPicker(false);
              }}
              onClose={() => setShowIconPicker(false)}
              anchorRect={folderIconRef.current?.getBoundingClientRect()}
              onRemove={() => {
                updateNode(node.id, { icon: undefined });
                setShowIconPicker(false);
              }}
            />
          )}
        </div>
      )}

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
      {(childFolders.length > 0 ||
        childTasks.length > 0 ||
        completeFolders.length > 0) && (
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
                          {folder.icon ? (
                            renderIcon(folder.icon, { size: 14 })
                          ) : (
                            <Folder
                              size={14}
                              className="shrink-0 text-notion-text-secondary"
                            />
                          )}
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
                                grandchild.icon ? (
                                  renderIcon(grandchild.icon, { size: 13 })
                                ) : (
                                  <Folder
                                    size={13}
                                    className="shrink-0 text-notion-text-secondary"
                                  />
                                )
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

          {/* Complete folders (always at bottom) */}
          {completeFolders.map((folder) => {
            const isExpanded = expandedFolders.has(folder.id);
            const count = getChildCount(folder.id);
            if (count === 0) return null;
            return (
              <div
                key={folder.id}
                className="mt-2 pt-2 border-t border-notion-border/50"
              >
                <div className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-sm text-notion-text-secondary hover:bg-notion-hover transition-colors">
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
                  <FolderCheck size={14} className="shrink-0 text-green-500" />
                  <span className="flex-1 truncate">
                    {t("taskTree.completeFolder")}
                  </span>
                  <span className="text-[10px] text-notion-text-secondary/60 shrink-0">
                    {count}
                  </span>
                </div>
                {isExpanded && (
                  <div className="ml-5 space-y-0.5 mt-0.5">
                    {getGrandchildren(folder.id).map((child) => (
                      <div
                        key={child.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectTask?.(child.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            onSelectTask?.(child.id);
                        }}
                        className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-sm text-notion-text-secondary hover:bg-notion-hover transition-colors text-left cursor-pointer line-through opacity-60"
                      >
                        <TaskStatusIcon
                          status={
                            (child.status as
                              | "NOT_STARTED"
                              | "IN_PROGRESS"
                              | "DONE") ?? "NOT_STARTED"
                          }
                          onClick={() => handleToggleTaskStatus(child.id)}
                          onSetStatus={(s) => handleSetTaskStatus(child.id, s)}
                        />
                        <span className="truncate">{child.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
