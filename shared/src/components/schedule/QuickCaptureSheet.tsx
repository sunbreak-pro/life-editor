import { useState } from "react";
import { BottomSheet } from "../BottomSheet";

/*
 * QuickCaptureSheet — the Mobile FAB's quick-capture form (title + start/end
 * time) inside a BottomSheet. Pure presentation (§3.1 / §6.4): copy injected
 * already translated, the single mutation is the onAdd callback; lumen-*
 * tokens only (§5). Enter submits (IME composition respected — §frontend
 * gotcha); a blank title is a no-op. Moved from web CalendarTab (#280).
 */

const FIELD =
  "w-full rounded-lumen-md border border-lumen-border bg-lumen-bg px-2.5 py-2 text-sm text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

export interface QuickCaptureLabels {
  title: string;
  placeholder: string;
  add: string;
  startTime: string;
  endTime: string;
}

export interface QuickCaptureSheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (title: string, start: string, end: string) => void;
  labels: QuickCaptureLabels;
}

export function QuickCaptureSheet({
  open,
  onClose,
  onAdd,
  labels,
}: QuickCaptureSheetProps) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed, start, end);
    setTitle("");
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={labels.title}>
      <div className="flex flex-col gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
          }}
          placeholder={labels.placeholder}
          aria-label={labels.title}
          className={FIELD}
        />
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-lumen-text-secondary">
            {labels.startTime}
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              aria-label={labels.startTime}
              className={`${FIELD} tabular-nums`}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-lumen-text-secondary">
            {labels.endTime}
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              aria-label={labels.endTime}
              className={`${FIELD} tabular-nums`}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={submit}
          className="rounded-lumen-md bg-lumen-accent py-2 text-center text-sm font-medium text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lumen-bg"
        >
          {labels.add}
        </button>
      </div>
    </BottomSheet>
  );
}
