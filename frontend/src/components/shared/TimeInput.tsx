import { useState, useRef, useCallback } from "react";

interface TimeInputProps {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
  minuteStep?: number;
  className?: string;
  size?: "sm" | "default";
}

type Field = "hour" | "minute";

function clampHour(v: number): number {
  return ((v % 24) + 24) % 24;
}

function clampMinute(v: number, step: number): number {
  const snapped = Math.round(v / step) * step;
  return ((snapped % 60) + 60) % 60;
}

export function TimeInput({
  hour,
  minute,
  onChange,
  minuteStep = 5,
  className = "",
  size = "default",
}: TimeInputProps) {
  const [activeField, setActiveField] = useState<Field | null>(null);
  const [editBuffer, setEditBuffer] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const hourRef = useRef<HTMLSpanElement>(null);
  const minuteRef = useRef<HTMLSpanElement>(null);

  const textClass = size === "sm" ? "text-xs" : "text-sm";

  const commitBuffer = useCallback(
    (field: Field, buffer: string) => {
      if (!buffer) return;
      const num = parseInt(buffer, 10);
      if (isNaN(num)) return;
      if (field === "hour") {
        onChange(clampHour(num), minute);
      } else {
        onChange(hour, clampMinute(num, minuteStep));
      }
    },
    [hour, minute, minuteStep, onChange],
  );

  const activateField = useCallback(
    (field: Field) => {
      if (activeField === field) return;
      if (activeField && editBuffer) {
        commitBuffer(activeField, editBuffer);
      }
      setActiveField(field);
      setEditBuffer("");
    },
    [activeField, editBuffer, commitBuffer],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      const related = e.relatedTarget as Node | null;
      if (containerRef.current?.contains(related)) return;
      if (activeField && editBuffer) {
        commitBuffer(activeField, editBuffer);
      }
      setActiveField(null);
      setEditBuffer("");
    },
    [activeField, editBuffer, commitBuffer],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!activeField) return;

      if (e.key === "Tab") {
        if (editBuffer) {
          commitBuffer(activeField, editBuffer);
        }
        if (activeField === "hour" && !e.shiftKey) {
          e.preventDefault();
          activateField("minute");
          minuteRef.current?.focus();
        } else if (activeField === "minute" && e.shiftKey) {
          e.preventDefault();
          activateField("hour");
          hourRef.current?.focus();
        } else {
          setActiveField(null);
          setEditBuffer("");
        }
        return;
      }

      if (e.key === "Enter" || e.key === "Escape") {
        if (editBuffer) {
          commitBuffer(activeField, editBuffer);
        }
        setActiveField(null);
        setEditBuffer("");
        containerRef.current?.blur();
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const delta = e.key === "ArrowUp" ? 1 : -1;
        if (activeField === "hour") {
          onChange(clampHour(hour + delta), minute);
        } else {
          onChange(hour, clampMinute(minute + delta * minuteStep, minuteStep));
        }
        setEditBuffer("");
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const next = editBuffer + e.key;
        setEditBuffer(next);

        if (activeField === "hour") {
          if (next.length >= 2) {
            const num = parseInt(next, 10);
            onChange(clampHour(num), minute);
            setEditBuffer("");
            setActiveField("minute");
            minuteRef.current?.focus();
          }
        } else {
          if (next.length >= 2) {
            const num = parseInt(next, 10);
            onChange(hour, clampMinute(num, minuteStep));
            setEditBuffer("");
            setActiveField(null);
          }
        }
        return;
      }
    },
    [
      activeField,
      editBuffer,
      hour,
      minute,
      minuteStep,
      onChange,
      commitBuffer,
      activateField,
    ],
  );

  // Display values
  const displayHour =
    activeField === "hour" && editBuffer
      ? editBuffer.padStart(2, " ")
      : String(hour).padStart(2, "0");
  const displayMinute =
    activeField === "minute" && editBuffer
      ? editBuffer.padStart(2, " ")
      : String(minute).padStart(2, "0");

  const fieldStyle = (field: Field) =>
    `outline-none cursor-pointer rounded px-0.5 tabular-nums ${
      activeField === field
        ? "bg-notion-accent/20 text-notion-accent"
        : "hover:bg-notion-hover"
    }`;

  return (
    <div
      ref={containerRef}
      className={`inline-flex items-center ${textClass} text-notion-text font-mono select-none ${className}`}
      onBlur={handleBlur}
    >
      <span
        ref={hourRef}
        tabIndex={0}
        role="spinbutton"
        aria-label="Hour"
        aria-valuenow={hour}
        aria-valuemin={0}
        aria-valuemax={23}
        className={fieldStyle("hour")}
        onClick={() => activateField("hour")}
        onFocus={() => {
          if (activeField !== "hour") activateField("hour");
        }}
        onKeyDown={handleKeyDown}
      >
        {displayHour}
      </span>
      <span className="text-notion-text-secondary mx-px">:</span>
      <span
        ref={minuteRef}
        tabIndex={0}
        role="spinbutton"
        aria-label="Minute"
        aria-valuenow={minute}
        aria-valuemin={0}
        aria-valuemax={59}
        className={fieldStyle("minute")}
        onClick={() => activateField("minute")}
        onFocus={() => {
          if (activeField !== "minute") activateField("minute");
        }}
        onKeyDown={handleKeyDown}
      >
        {displayMinute}
      </span>
    </div>
  );
}
