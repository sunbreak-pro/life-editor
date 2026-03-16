import { useState, useRef, useCallback, useEffect } from "react";

interface InlineDurationEditorProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  suffix?: string;
}

export function InlineDurationEditor({
  value,
  onChange,
  disabled = false,
  min = 1,
  max = 240,
  suffix = "m",
}: InlineDurationEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    const parsed = parseInt(draft, 10);
    if (!isNaN(parsed)) {
      onChange(Math.max(min, Math.min(max, parsed)));
    }
    setEditing(false);
  }, [draft, onChange, min, max]);

  const cancel = useCallback(() => {
    setDraft(String(value));
    setEditing(false);
  }, [value]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={draft}
        min={min}
        max={max}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        onBlur={commit}
        className="w-14 px-1.5 py-0.5 text-scaling-sm text-right font-medium rounded border border-notion-accent bg-notion-bg text-notion-text focus:outline-none"
      />
    );
  }

  return (
    <span
      onClick={
        disabled
          ? undefined
          : () => {
              setDraft(String(value));
              setEditing(true);
            }
      }
      className={`font-medium bg-notion-hover px-2 py-0.5 rounded text-notion-text ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "cursor-pointer hover:bg-notion-hover/80"
      }`}
    >
      {value}
      {suffix}
    </span>
  );
}
