import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { BottomSheet } from "../BottomSheet";
import { Button } from "../Button";
import { Input } from "../Input";

export interface QuickAddSheetProps {
  open: boolean;
  onClose: () => void;
  /** Already-translated sheet title (§6.4). */
  title: string;
  /** Already-translated input placeholder (§6.4). */
  placeholder: string;
  /** Already-translated submit button label (§6.4). */
  submitLabel: string;
  /** Fires only with a trimmed, non-empty value; input clears + sheet closes after. */
  onSubmit: (value: string) => void;
  className?: string;
}

/*
 * Shortest-path add sheet — a BottomSheet with a single Input + submit button
 * for quick capture (Notes / Daily / Tags on Mobile). Enter submits (guarded
 * against IME composition, §6.6); empty / whitespace-only input keeps the
 * button disabled. The input autofocuses when the sheet opens and the draft
 * resets when it closes. Pure presentation over injected copy (§6.4).
 */
export function QuickAddSheet({
  open,
  onClose,
  title,
  placeholder,
  submitLabel,
  onSubmit,
  className,
}: QuickAddSheetProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const canSubmit = value.trim() !== "";

  // Autofocus on open (BottomSheet has mounted its portal by the time this
  // effect runs), and clear the draft whenever the sheet closes.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else {
      setValue("");
    }
  }, [open]);

  const submit = () => {
    const next = value.trim();
    if (next === "") return;
    onSubmit(next);
    setValue("");
    onClose();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    submit();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      className={className}
    >
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          variant="primary"
          onClick={submit}
          disabled={!canSubmit}
          className="shrink-0"
        >
          {submitLabel}
        </Button>
      </div>
    </BottomSheet>
  );
}
