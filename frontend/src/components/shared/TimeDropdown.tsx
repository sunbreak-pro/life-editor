import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Clock } from "lucide-react";

interface TimeDropdownProps {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
  minuteStep?: number;
  size?: "sm" | "default";
  className?: string;
}

interface TimeOption {
  hour: number;
  minute: number;
  label: string;
}

function generateTimeOptions(step: number): TimeOption[] {
  const options: TimeOption[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += step) {
      options.push({
        hour: h,
        minute: m,
        label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      });
    }
  }
  return options;
}

function parseTimeInput(
  value: string,
): { hour: number; minute: number } | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { hour: h, minute: m };
}

export function TimeDropdown({
  hour,
  minute,
  onChange,
  minuteStep = 15,
  size = "default",
  className = "",
}: TimeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => generateTimeOptions(minuteStep), [minuteStep]);

  const displayLabel = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  const handleSelect = useCallback(
    (opt: TimeOption) => {
      onChange(opt.hour, opt.minute);
      setIsOpen(false);
      setInputValue("");
    },
    [onChange],
  );

  const handleInputConfirm = useCallback(() => {
    const parsed = parseTimeInput(inputValue);
    if (parsed) {
      onChange(parsed.hour, parsed.minute);
      setIsOpen(false);
      setInputValue("");
    }
  }, [inputValue, onChange]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleInputConfirm();
      } else if (e.key === "Escape") {
        setIsOpen(false);
        setInputValue("");
      }
    },
    [handleInputConfirm],
  );

  // Scroll to selected item on open
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        selectedRef.current?.scrollIntoView({ block: "center" });
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      )
        return;
      setIsOpen(false);
      setInputValue("");
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isOpen]);

  const textClass = size === "sm" ? "text-xs" : "text-sm";

  const dropdownContent = isOpen
    ? (() => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return null;

        const dropdownHeight = 240;
        const spaceBelow = window.innerHeight - rect.bottom - 8;
        const openBelow = spaceBelow >= dropdownHeight;

        const style: React.CSSProperties = {
          position: "fixed",
          left: rect.left,
          width: Math.max(rect.width, 120),
          zIndex: 9999,
          ...(openBelow
            ? { top: rect.bottom + 4 }
            : { bottom: window.innerHeight - rect.top + 4 }),
        };

        return createPortal(
          <div
            ref={dropdownRef}
            style={style}
            className="bg-notion-bg border border-notion-border rounded-lg shadow-lg overflow-hidden"
          >
            {/* Manual input */}
            <div className="p-1.5 border-b border-notion-border">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={displayLabel}
                className="w-full px-2 py-1 text-xs bg-notion-bg-secondary border border-notion-border rounded text-notion-text outline-none focus:border-notion-accent/50 font-mono placeholder:text-notion-text-secondary/50"
              />
            </div>
            {/* Time list */}
            <div
              className="overflow-y-auto"
              style={{ maxHeight: dropdownHeight }}
            >
              {options.map((opt) => {
                const isSelected = opt.hour === hour && opt.minute === minute;
                return (
                  <button
                    key={opt.label}
                    ref={isSelected ? selectedRef : undefined}
                    onClick={() => handleSelect(opt)}
                    className={`w-full px-3 py-1.5 text-left text-xs font-mono transition-colors ${
                      isSelected
                        ? "bg-notion-accent/10 text-notion-accent font-medium"
                        : "text-notion-text hover:bg-notion-hover"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        );
      })()
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1 border border-notion-border rounded-md px-1.5 py-1 font-mono ${textClass} text-notion-text hover:border-notion-accent/50 transition-colors bg-notion-bg ${className}`}
      >
        <Clock
          size={size === "sm" ? 10 : 12}
          className="text-notion-text-secondary shrink-0"
        />
        {displayLabel}
      </button>
      {dropdownContent}
    </>
  );
}
