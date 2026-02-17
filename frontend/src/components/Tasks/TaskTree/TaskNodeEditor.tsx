import { useState, useRef, useEffect } from "react";
import type { KeyboardEvent } from "react";

interface TaskNodeEditorProps {
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export function TaskNodeEditor({ initialValue, onSave, onCancel }: TaskNodeEditorProps) {
  const [editValue, setEditValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const savedValueRef = useRef(initialValue);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleBlurSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== savedValueRef.current) {
      onSave(trimmed);
    }
    onCancel();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      const trimmed = editValue.trim();
      if (trimmed && trimmed !== savedValueRef.current) {
        onSave(trimmed);
        savedValueRef.current = trimmed;
      } else {
        onCancel();
      }
    }
    if (e.key === "Escape") onCancel();
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={handleBlurSave}
      onKeyDown={handleKeyDown}
      maxLength={255}
      className="flex-1 bg-transparent outline-none text-[15px] text-notion-text px-1 border-b border-notion-accent"
    />
  );
}
