import { useState, useCallback, useRef } from "react";

/**
 * Two-stage Enter submit hook:
 * 1st Enter → blur input (confirm text), 2nd Enter → submit & close.
 * Provides visual feedback via `readyToSubmit` state.
 */
export function useConfirmableSubmit(
  onSubmit: () => void,
  onCancel?: () => void,
) {
  const [readyToSubmit, setReadyToSubmit] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (readyToSubmit) {
          onSubmit();
        } else {
          inputRef.current?.blur();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel?.();
      }
    },
    [readyToSubmit, onSubmit, onCancel],
  );

  const handleBlur = useCallback(() => {
    setReadyToSubmit(true);
  }, []);

  const handleFocus = useCallback(() => {
    setReadyToSubmit(false);
  }, []);

  return { inputRef, handleKeyDown, handleBlur, handleFocus, readyToSubmit };
}
