import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import { TimeInput } from "../../../shared/TimeInput";

interface ScheduleItemCreatePopoverProps {
  position: { x: number; y: number };
  defaultStartTime: string;
  defaultEndTime: string;
  onSubmit: (title: string, startTime: string, endTime: string) => void;
  onClose: () => void;
}

export function ScheduleItemCreatePopover({
  position,
  defaultStartTime,
  defaultEndTime,
  onSubmit,
  onClose,
}: ScheduleItemCreatePopoverProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useClickOutside(ref, onClose, true);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    onSubmit(title.trim() || "Untitled", startTime, endTime);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const left = Math.min(position.x, window.innerWidth - 240 - 16);
  const top = Math.min(position.y, window.innerHeight - 200 - 16);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-notion-bg border border-notion-border rounded-lg shadow-xl p-3"
      style={{ left, top, width: 240 }}
    >
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("schedule.itemTitlePlaceholder", "Schedule item name")}
        className="w-full px-2 py-1.5 text-sm bg-transparent border border-notion-border rounded-md outline-none focus:border-notion-accent text-notion-text placeholder:text-notion-text-secondary"
      />

      <div className="flex items-center gap-2 mt-2">
        <div className="flex-1">
          <label className="text-[10px] text-notion-text-secondary mb-0.5 block">
            {t("schedule.start", "Start")}
          </label>
          <TimeInput
            hour={parseInt(startTime.split(":")[0] || "0", 10)}
            minute={parseInt(startTime.split(":")[1] || "0", 10)}
            onChange={(h, m) =>
              setStartTime(
                `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
              )
            }
            minuteStep={1}
            size="sm"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-notion-text-secondary mb-0.5 block">
            {t("schedule.end", "End")}
          </label>
          <TimeInput
            hour={parseInt(endTime.split(":")[0] || "0", 10)}
            minute={parseInt(endTime.split(":")[1] || "0", 10)}
            onChange={(h, m) =>
              setEndTime(
                `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
              )
            }
            minuteStep={1}
            size="sm"
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        className="w-full mt-2 px-3 py-1.5 text-xs bg-notion-accent text-white rounded-md hover:bg-notion-accent/90 transition-colors"
      >
        {t("schedule.create", "Create")}
      </button>
    </div>
  );
}
