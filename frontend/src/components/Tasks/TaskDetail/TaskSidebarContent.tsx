import { useRef, useState } from "react";
import { ChevronRight, Folder, StickyNote, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconPicker } from "../../common/IconPicker";
import { DateTimeRangePicker } from "../Schedule/shared/DateTimeRangePicker";
import { RoleSwitcher } from "../Schedule/shared/RoleSwitcher";
import { PriorityPicker } from "../../shared/PriorityPicker";
import { ReminderToggle } from "../../shared/ReminderToggle";
import { WikiTagList } from "../../WikiTags/WikiTagList";
import { TaskStatusIcon } from "../TaskTree/TaskStatusIcon";
import {
  useRoleConversion,
  type ConversionRole,
  type ConversionSource,
} from "../../../hooks/useRoleConversion";
import type { TaskNode, TaskStatus } from "../../../types/taskTree";
import { getAncestors } from "../../../utils/breadcrumb";
import { fireTaskCompleteConfetti } from "../../../utils/confetti";
import { formatDateKey } from "../../../utils/dateKey";
import { renderIcon } from "../../../utils/iconRenderer";
import { playEffectSound } from "../../../utils/playEffectSound";
import { InlineEditableHeading } from "./InlineEditableHeading";

interface TaskSidebarContentProps {
  node: TaskNode;
  nodes: TaskNode[];
  updateNode: (id: string, updates: Partial<TaskNode>) => void;
  softDelete: (id: string) => void;
  onPlayTask?: (node: TaskNode) => void;
  toggleTaskStatus: (id: string) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
}

export function TaskSidebarContent({
  node,
  nodes,
  updateNode,
  softDelete,
  toggleTaskStatus,
  setTaskStatus,
}: TaskSidebarContentProps) {
  const { t } = useTranslation();
  const [iconPickerNodeId, setIconPickerNodeId] = useState<string | null>(null);
  const iconBtnRef = useRef<HTMLButtonElement>(null);
  const ancestors = getAncestors(node.id, nodes);

  return (
    <div className="flex flex-col h-full">
      {/* Header section */}
      <div className="space-y-3 pb-4 border-b border-notion-border mb-4">
        {/* Row 1: Breadcrumb */}
        <div className="flex items-center gap-2 min-h-8">
          <div className="flex items-center gap-1 text-sm text-notion-text-secondary flex-1 min-w-0 overflow-x-auto">
            {ancestors.length > 0 ? (
              ancestors.map((ancestor, i) => (
                <div
                  key={ancestor.id}
                  className="flex items-center gap-1 shrink-0"
                >
                  {i > 0 && (
                    <ChevronRight
                      size={12}
                      className="text-notion-text-secondary"
                    />
                  )}
                  <button
                    ref={
                      iconPickerNodeId === ancestor.id ? iconBtnRef : undefined
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      setIconPickerNodeId(
                        iconPickerNodeId === ancestor.id ? null : ancestor.id,
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
                  {iconPickerNodeId === ancestor.id && (
                    <IconPicker
                      value={ancestor.icon}
                      onSelect={(iconName) => {
                        updateNode(ancestor.id, { icon: iconName });
                        setIconPickerNodeId(null);
                      }}
                      onClose={() => setIconPickerNodeId(null)}
                      anchorRect={iconBtnRef.current?.getBoundingClientRect()}
                      onRemove={() => {
                        updateNode(ancestor.id, { icon: undefined });
                        setIconPickerNodeId(null);
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
        </div>

        {/* Row 2: Status + Title */}
        <div className="flex items-center gap-2">
          <TaskStatusIcon
            status={
              (node.status as "NOT_STARTED" | "IN_PROGRESS" | "DONE") ??
              "NOT_STARTED"
            }
            onClick={() => {
              const prev = node.status ?? "NOT_STARTED";
              toggleTaskStatus(node.id);
              if (prev === "IN_PROGRESS") {
                fireTaskCompleteConfetti();
                playEffectSound("complete");
              }
            }}
            onSetStatus={(s) => {
              const prev = node.status ?? "NOT_STARTED";
              setTaskStatus(node.id, s);
              if (s === "DONE" && prev !== "DONE") {
                fireTaskCompleteConfetti();
                playEffectSound("complete");
              }
            }}
          />
          <div className="flex-1 min-w-0">
            <InlineEditableHeading
              key={node.id}
              value={node.title}
              onSave={(title) => updateNode(node.id, { title })}
            />
          </div>
        </div>

        {/* Row 3: WikiTags */}
        <WikiTagList entityId={node.id} entityType="task" />

        {/* Row 3.5: Role Switcher */}
        <TaskRoleSwitcherRow node={node} />

        {/* Row 4: Actions */}
        <div className="flex items-center gap-2">
          <PriorityPicker
            value={node.priority}
            onChange={(p) => updateNode(node.id, { priority: p })}
          />
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
            <ReminderToggle
              enabled={!!node.reminderEnabled}
              offset={node.reminderOffset ?? 30}
              onEnabledChange={(enabled) =>
                updateNode(node.id, { reminderEnabled: enabled })
              }
              onOffsetChange={(offset) =>
                updateNode(node.id, { reminderOffset: offset })
              }
              compact
            />
          )}

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
