import { useState, useRef, useEffect } from "react";

interface InlineMemoInputProps {
  value: string;
  onSave: (value: string | null) => void;
  onClose: () => void;
}

export function InlineMemoInput({
  value,
  onSave,
  onClose,
}: InlineMemoInputProps) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = () => {
    const trimmed = text.trim();
    onSave(trimmed || null);
    onClose();
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") handleSave();
        if (e.key === "Escape") onClose();
      }}
      onBlur={handleSave}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      placeholder="memo..."
      className="w-full text-xs bg-transparent outline-none border-b border-notion-accent/50 text-current placeholder:text-current/30 px-0.5"
    />
  );
}
