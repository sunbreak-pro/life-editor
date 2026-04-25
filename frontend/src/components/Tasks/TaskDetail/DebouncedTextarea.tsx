import { useEffect, useRef, useState } from "react";

/**
 * Textarea that debounces `onSave` by 500ms and flushes on unmount.
 *
 * Used by TaskSidebarContent / FolderSidebarContent for the description
 * field — typing should not write to the DB on every keystroke, but a
 * pending edit must not be lost when the user navigates away.
 *
 * `key={node.id}` reseeds `initialValue` when the selected entity
 * changes; the prop-sync effect handles edits that arrive from outside
 * (sync, undo) while the same entity is selected.
 */
export function DebouncedTextarea({
  initialValue,
  onSave,
  placeholder,
}: {
  initialValue: string;
  onSave: (value: string) => void;
  placeholder?: string;
}) {
  const [localValue, setLocalValue] = useState(initialValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef(localValue);

  useEffect(() => {
    setLocalValue(initialValue);
    latestValueRef.current = initialValue;
  }, [initialValue]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        if (latestValueRef.current !== initialValue) {
          onSave(latestValueRef.current);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (val: string) => {
    setLocalValue(val);
    latestValueRef.current = val;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSave(val);
    }, 500);
  };

  return (
    <textarea
      value={localValue}
      onChange={(e) => handleChange(e.target.value)}
      onKeyDown={(e) => e.stopPropagation()}
      placeholder={placeholder}
      className="w-full min-h-24 text-sm bg-notion-bg-secondary border border-notion-border rounded-lg p-2 text-notion-text placeholder:text-notion-text-secondary/50 resize-y outline-none focus:border-notion-accent/50 transition-colors"
    />
  );
}
