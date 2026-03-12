import { useState, useCallback, useRef } from "react";

interface ConfirmableSubmitOptions {
  singleEnter?: boolean;
}

/**
 * Two-stage Enter submit hook:
 * 1st Enter → blur input (confirm text), 2nd Enter → submit & close.
 * Provides visual feedback via `readyToSubmit` state.
 *
 * When `singleEnter` is true, 1st Enter immediately submits.
 */
export function useConfirmableSubmit(
  onSubmit: () => void,
  onCancel?: () => void,
  options?: ConfirmableSubmitOptions,
) {
  const [readyToSubmit, setReadyToSubmit] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const singleEnter = options?.singleEnter ?? false;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (singleEnter || readyToSubmit) {
          onSubmit();
        } else {
          inputRef.current?.blur();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel?.();
      }
    },
    [readyToSubmit, singleEnter, onSubmit, onCancel],
  );

  const handleBlur = useCallback(() => {
    setReadyToSubmit(true);
  }, []);

  const handleFocus = useCallback(() => {
    setReadyToSubmit(false);
  }, []);

  return { inputRef, handleKeyDown, handleBlur, handleFocus, readyToSubmit };
}
