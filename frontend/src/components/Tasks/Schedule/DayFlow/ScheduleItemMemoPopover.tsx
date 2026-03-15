import { useState, useRef, useEffect, useCallback } from "react";

interface ScheduleItemMemoPopoverProps {
  anchorRect: DOMRect;
  initialValue: string;
  onSave: (value: string) => void;
  onClose: () => void;
}

export function ScheduleItemMemoPopover({
  anchorRect,
  initialValue,
  onSave,
  onClose,
}: ScheduleItemMemoPopoverProps) {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSaveAndClose = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed !== initialValue.trim()) {
      onSave(trimmed || "");
    }
    onClose();
  }, [value, initialValue, onSave, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        handleSaveAndClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose, handleSaveAndClose]);

  const top = anchorRect.bottom + 4;
  const left = Math.min(anchorRect.left, window.innerWidth - 260);

  return (
    <div
      ref={panelRef}
      className="fixed z-[100] w-60 bg-notion-bg border border-notion-border rounded-lg shadow-xl p-2"
      style={{ top, left }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a memo..."
        className="w-full h-20 text-xs bg-transparent text-notion-text resize-none outline-none placeholder:text-notion-text-secondary/50"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            handleSaveAndClose();
          }
        }}
      />
      <div className="flex justify-end gap-1 mt-1">
        <button
          onClick={onClose}
          className="px-2 py-0.5 text-[10px] text-notion-text-secondary hover:text-notion-text rounded transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSaveAndClose}
          className="px-2 py-0.5 text-[10px] bg-notion-accent text-white rounded hover:bg-notion-accent/80 transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}
