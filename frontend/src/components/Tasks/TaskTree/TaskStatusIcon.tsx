import { memo, useState, useRef, useEffect, useCallback } from "react";
import { Circle, CircleDot, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskStatus } from "../../../types/taskTree";

interface TaskStatusIconProps {
  status: TaskStatus;
  onClick: () => void;
  onSetStatus?: (status: TaskStatus) => void;
}

const STATUS_CONFIG: Record<
  TaskStatus,
  {
    labelKey: string;
    badgeClass: string;
  }
> = {
  NOT_STARTED: {
    labelKey: "taskStatus.notStarted",
    badgeClass: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  },
  IN_PROGRESS: {
    labelKey: "taskStatus.inProgress",
    badgeClass: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300",
  },
  DONE: {
    labelKey: "taskStatus.done",
    badgeClass:
      "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300",
  },
};

const ALL_STATUSES: TaskStatus[] = ["NOT_STARTED", "IN_PROGRESS", "DONE"];

export const TaskStatusIcon = memo(function TaskStatusIcon({
  status,
  onClick,
  onSetStatus,
}: TaskStatusIconProps) {
  const { t } = useTranslation();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(e.target as Node)
    ) {
      setShowDropdown(false);
    }
  }, []);

  useEffect(() => {
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown, handleClickOutside]);

  const config = STATUS_CONFIG[status];

  const handleBadgeClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onSetStatus) {
        setShowDropdown((prev) => !prev);
      }
    },
    [onSetStatus],
  );

  const handleStatusSelect = useCallback(
    (newStatus: TaskStatus) => {
      if (onSetStatus && newStatus !== status) {
        onSetStatus(newStatus);
      }
      setShowDropdown(false);
    },
    [onSetStatus, status],
  );

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-0.5 shrink-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >
      {/* Icon button: forward-cycle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="flex items-center shrink-0"
      >
        {status === "NOT_STARTED" && (
          <Circle
            size={14}
            className="text-notion-text-secondary hover:text-notion-text transition-colors"
          />
        )}
        {status === "IN_PROGRESS" && (
          <CircleDot
            size={14}
            className="text-blue-500 hover:text-blue-400 transition-colors"
          />
        )}
        {status === "DONE" && (
          <CheckCircle2
            size={14}
            className="text-green-500 hover:text-notion-text-secondary transition-colors"
          />
        )}
      </button>

      {/* Hover badge */}
      {(isHovered || showDropdown) && onSetStatus && (
        <button
          onClick={handleBadgeClick}
          className={`text-[10px] leading-none px-1.5 py-0.5 rounded-full whitespace-nowrap font-medium cursor-pointer transition-opacity ${config.badgeClass}`}
        >
          {t(config.labelKey)}
        </button>
      )}

      {/* Dropdown */}
      {showDropdown && onSetStatus && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-full mt-1 z-50 bg-notion-bg border border-notion-border rounded-lg shadow-lg py-1 min-w-28"
        >
          {ALL_STATUSES.map((s) => {
            const sc = STATUS_CONFIG[s];
            const isActive = s === status;
            return (
              <button
                key={s}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusSelect(s);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-notion-hover transition-colors ${
                  isActive ? "font-semibold" : ""
                }`}
              >
                <span
                  className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] leading-none font-medium ${sc.badgeClass}`}
                >
                  {t(sc.labelKey)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
