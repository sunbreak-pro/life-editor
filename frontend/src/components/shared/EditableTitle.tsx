import { useState, useRef, useEffect } from "react";
import type { KeyboardEvent } from "react";

interface EditableTitleProps {
  value: string;
  onSave: (trimmedValue: string) => void;
  onCancel: () => void;
  className?: string;
  maxLength?: number;
  autoFocus?: boolean;
  selectAllOnFocus?: boolean;
  checkComposing?: boolean;
  placeholder?: string;
}

export function EditableTitle({
  value,
  onSave,
  onCancel,
  className = "",
  maxLength = 255,
  autoFocus = true,
  selectAllOnFocus = true,
  checkComposing = false,
  placeholder,
}: EditableTitleProps) {
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const savedValueRef = useRef(value);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      if (selectAllOnFocus) {
        inputRef.current.select();
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== savedValueRef.current) {
      onSave(trimmed);
      savedValueRef.current = trimmed;
    }
    onCancel();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (checkComposing && e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      maxLength={maxLength}
      placeholder={placeholder}
      className={className}
    />
  );
}
