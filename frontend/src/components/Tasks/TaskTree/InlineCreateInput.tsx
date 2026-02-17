import { useState, useRef, useEffect } from "react";
import type { KeyboardEvent } from "react";

interface InlineCreateInputProps {
  placeholder: string;
  onSubmit: (title: string) => void;
  onCancel: () => void;
}

export function InlineCreateInput({
  placeholder,
  onSubmit,
  onCancel,
}: InlineCreateInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleBlurSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onSubmit(trimmed);
    }
    onCancel();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const trimmed = value.trim();
      if (trimmed) {
        onSubmit(trimmed);
        setValue("");
      } else {
        onCancel();
      }
    }
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlurSubmit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={255}
        className="flex-1 bg-transparent outline-none text-[15px] text-notion-text px-1 border-b border-notion-accent placeholder:text-notion-text-secondary/50"
      />
    </div>
  );
}
