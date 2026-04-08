import { useState, useRef, useEffect } from "react";
import { Flag } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Priority } from "../../types/priority";
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  PRIORITY_OPTIONS,
} from "../../types/priority";

interface PriorityPickerProps {
  value: Priority | null | undefined;
  onChange: (priority: Priority | null) => void;
}

export function PriorityPicker({ value, onChange }: PriorityPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const currentColor = value ? PRIORITY_COLORS[value] : undefined;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-notion-bg-hover text-notion-text-secondary transition-colors"
        title={t("priority.setPriority")}
      >
        <Flag
          size={14}
          style={currentColor ? { color: currentColor } : undefined}
          fill={currentColor ?? "none"}
        />
        {value && (
          <span className="text-xs font-medium" style={{ color: currentColor }}>
            {PRIORITY_LABELS[value]}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-notion-bg border border-notion-border rounded-lg shadow-lg py-1 min-w-[140px]">
          {PRIORITY_OPTIONS.map((p) => (
            <button
              key={p}
              onClick={() => {
                onChange(p);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-notion-bg-hover transition-colors ${
                value === p ? "bg-notion-bg-hover" : ""
              }`}
            >
              <Flag
                size={14}
                style={{ color: PRIORITY_COLORS[p] }}
                fill={PRIORITY_COLORS[p]}
              />
              <span className="text-notion-text">
                {t(`priority.p${p}` as const)}
              </span>
            </button>
          ))}
          <div className="border-t border-notion-border my-1" />
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-notion-bg-hover transition-colors"
          >
            <Flag size={14} className="text-notion-text-secondary" />
            <span className="text-notion-text-secondary">
              {t("priority.none")}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
