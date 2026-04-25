import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

/**
 * Click-to-edit heading. Renders as `<h2>` in read mode and switches to a
 * trimmed-on-blur `<input>` while editing.
 *
 * Distinct from `components/shared/EditableTitle` — that variant is a pure
 * controlled input (caller owns the edit state); this variant owns its own
 * `isEditing` state and renders the heading display itself.
 */
export function InlineEditableHeading({
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
