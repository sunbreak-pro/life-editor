import { useRef, useState } from "react";
import { Check, Trash2, StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ScheduleItem } from "../../../../types/schedule";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import { InlineMemoInput } from "./InlineMemoInput";

interface ScheduleItemPreviewPopupProps {
  item: ScheduleItem;
  position: { x: number; y: number };
  onToggleComplete: () => void;
  onUpdateMemo?: (memo: string | null) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ScheduleItemPreviewPopup({
  item,
  position,
  onToggleComplete,
  onUpdateMemo,
  onDelete,
  onClose,
}: ScheduleItemPreviewPopupProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [showMemoInput, setShowMemoInput] = useState(false);

  useClickOutside(ref, onClose, !showMemoInput);

  const left = Math.min(position.x, window.innerWidth - 260 - 16);
  const top = Math.min(position.y, window.innerHeight - 200 - 16);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-64 bg-notion-bg border border-notion-border rounded-lg shadow-xl"
      style={{ left, top }}
    >
      <div className="p-3 space-y-2">
        <div className="font-medium text-sm text-notion-text truncate">
          {item.title}
        </div>
        <div className="text-xs text-notion-text-secondary">
          {item.startTime} - {item.endTime}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block px-1.5 py-0.5 text-[10px] rounded-full font-medium ${
              item.completed
                ? "bg-green-100 text-green-700"
                : item.routineId
                  ? "bg-notion-accent/10 text-notion-accent"
                  : "bg-gray-100 text-gray-600"
            }`}
          >
            {item.completed ? "DONE" : item.routineId ? "Routine" : "Schedule"}
          </span>
        </div>
        {showMemoInput && onUpdateMemo && (
          <InlineMemoInput
            value={item.memo ?? ""}
            onSave={(val) => {
              onUpdateMemo(val);
              setShowMemoInput(false);
            }}
            onClose={() => setShowMemoInput(false)}
          />
        )}
        {!showMemoInput && item.memo && (
          <div className="text-xs text-notion-text-secondary italic truncate">
            {item.memo}
          </div>
        )}
      </div>
      <div className="border-t border-notion-border flex">
        <button
          onClick={onToggleComplete}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs transition-colors ${
            item.completed
              ? "text-green-600 hover:bg-green-50"
              : "text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text"
          }`}
        >
          <Check size={12} />
          {item.completed ? "DONE" : "Complete"}
        </button>
        {onUpdateMemo && (
          <>
            <div className="w-px bg-notion-border" />
            <button
              onClick={() => setShowMemoInput(true)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text transition-colors"
            >
              <StickyNote size={12} />
              Memo
            </button>
          </>
        )}
      </div>
      <div className="border-t border-notion-border flex">
        <button
          onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-red-500 hover:bg-red-500/5 transition-colors"
        >
          <Trash2 size={12} />
          {t("common.delete")}
        </button>
      </div>
    </div>
  );
}
