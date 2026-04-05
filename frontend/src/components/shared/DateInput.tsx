import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

interface DateInputProps {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  onChange: (year: number, month: number, day: number) => void;
  size?: "sm" | "default";
}

type Field = "month" | "day";

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function clampMonth(v: number): number {
  return Math.max(1, Math.min(12, v));
}

function clampDay(v: number, year: number, month: number): number {
  return Math.max(1, Math.min(daysInMonth(year, month), v));
}

export function DateInput({
  year,
  month,
  day,
  onChange,
  size = "default",
}: DateInputProps) {
  const { i18n } = useTranslation();
  const isJa = i18n.language === "ja";
  const [activeField, setActiveField] = useState<Field | null>(null);
  const [editBuffer, setEditBuffer] = useState("");
  const editBufferRef = useRef("");
  const containerRef = useRef<HTMLDivElement>(null);
  const monthRef = useRef<HTMLSpanElement>(null);
  const dayRef = useRef<HTMLSpanElement>(null);

  const textClass = size === "sm" ? "text-xs" : "text-sm";

  const commitBuffer = useCallback(
    (field: Field, buffer: string) => {
      if (!buffer) return;
      const num = parseInt(buffer, 10);
      if (isNaN(num)) return;
      if (field === "month") {
        const m = clampMonth(num);
        const d = clampDay(day, year, m);
        onChange(year, m, d);
      } else {
        onChange(year, month, clampDay(num, year, month));
      }
    },
    [year, month, day, onChange],
  );

  const activateField = useCallback(
    (field: Field) => {
      if (activeField === field) return;
      if (activeField && editBufferRef.current) {
        commitBuffer(activeField, editBufferRef.current);
      }
      setActiveField(field);
      editBufferRef.current = "";
      setEditBuffer("");
    },
    [activeField, commitBuffer],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      const related = e.relatedTarget as Node | null;
      if (containerRef.current?.contains(related)) return;
      if (activeField && editBufferRef.current) {
        commitBuffer(activeField, editBufferRef.current);
      }
      setActiveField(null);
      editBufferRef.current = "";
      setEditBuffer("");
    },
    [activeField, commitBuffer],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!activeField) return;

      if (e.key === "Tab") {
        if (editBufferRef.current) {
          commitBuffer(activeField, editBufferRef.current);
        }
        if (activeField === "month" && !e.shiftKey) {
          e.preventDefault();
          editBufferRef.current = "";
          setEditBuffer("");
          activateField("day");
          dayRef.current?.focus();
        } else if (activeField === "day" && e.shiftKey) {
          e.preventDefault();
          editBufferRef.current = "";
          setEditBuffer("");
          activateField("month");
          monthRef.current?.focus();
        } else {
          setActiveField(null);
          editBufferRef.current = "";
          setEditBuffer("");
        }
        return;
      }

      if (e.key === "Enter" || e.key === "Escape") {
        if (editBufferRef.current) {
          commitBuffer(activeField, editBufferRef.current);
        }
        setActiveField(null);
        editBufferRef.current = "";
        setEditBuffer("");
        containerRef.current?.blur();
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const delta = e.key === "ArrowUp" ? 1 : -1;
        if (activeField === "month") {
          const m = clampMonth(month + delta);
          const d = clampDay(day, year, m);
          onChange(year, m, d);
        } else {
          onChange(year, month, clampDay(day + delta, year, month));
        }
        editBufferRef.current = "";
        setEditBuffer("");
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const next = editBufferRef.current + e.key;
        editBufferRef.current = next;
        setEditBuffer(next);

        if (activeField === "month") {
          if (next.length >= 2) {
            const num = parseInt(next, 10);
            const m = clampMonth(num);
            const d = clampDay(day, year, m);
            onChange(year, m, d);
            editBufferRef.current = "";
            setEditBuffer("");
            setActiveField("day");
            dayRef.current?.focus();
          }
        } else {
          if (next.length >= 2) {
            const num = parseInt(next, 10);
            onChange(year, month, clampDay(num, year, month));
            editBufferRef.current = "";
            setEditBuffer("");
            setActiveField(null);
          }
        }
        return;
      }
    },
    [activeField, year, month, day, onChange, commitBuffer, activateField],
  );

  const displayMonth =
    activeField === "month" && editBuffer ? editBuffer : String(month);
  const displayDay =
    activeField === "day" && editBuffer ? editBuffer : String(day);

  const fieldStyle = (field: Field) =>
    `outline-none cursor-pointer rounded px-0.5 tabular-nums ${
      activeField === field
        ? "bg-notion-accent/20 text-notion-accent"
        : "hover:bg-notion-hover"
    }`;

  return (
    <div
      ref={containerRef}
      className={`inline-flex items-center border border-notion-border rounded-md px-1.5 py-1 ${textClass} text-notion-text font-mono select-none`}
      onBlur={handleBlur}
    >
      <span
        ref={monthRef}
        tabIndex={0}
        role="spinbutton"
        aria-label="Month"
        aria-valuenow={month}
        aria-valuemin={1}
        aria-valuemax={12}
        className={fieldStyle("month")}
        onClick={() => activateField("month")}
        onFocus={() => {
          if (activeField !== "month") activateField("month");
        }}
        onKeyDown={handleKeyDown}
      >
        {displayMonth}
      </span>
      <span className="text-notion-text-secondary mx-px">
        {isJa ? "月" : "/"}
      </span>
      <span
        ref={dayRef}
        tabIndex={0}
        role="spinbutton"
        aria-label="Day"
        aria-valuenow={day}
        aria-valuemin={1}
        aria-valuemax={daysInMonth(year, month)}
        className={fieldStyle("day")}
        onClick={() => activateField("day")}
        onFocus={() => {
          if (activeField !== "day") activateField("day");
        }}
        onKeyDown={handleKeyDown}
      >
        {displayDay}
      </span>
      {isJa && <span className="text-notion-text-secondary mx-px">日</span>}
    </div>
  );
}
