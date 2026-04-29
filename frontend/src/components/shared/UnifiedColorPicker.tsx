import { useState, useRef, useEffect } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

const TAG_PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#84cc16", // lime
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f43f5e", // rose
  "#64748b", // slate
] as const;

interface UnifiedColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  /** Kept for API compatibility. "preset-only" hides the custom native picker. */
  mode?: "preset-only" | "preset-full";
  presets?: readonly string[];
  showTextColor?: boolean;
  textColor?: string | null;
  effectiveTextColor?: string;
  onTextColorChange?: (color: string | undefined) => void;
  onClose?: () => void;
  inline?: boolean;
  /**
   * With `inline=true`, drops the picker's own border/bg/shadow and lets the
   * grid stretch to fill the parent. Use when the consumer already provides
   * a bordered container so we don't render nested boxes.
   */
  embedded?: boolean;
}

type ColorTab = "background" | "text";

export function UnifiedColorPicker({
  color,
  onChange,
  mode = "preset-full",
  presets = TAG_PRESET_COLORS,
  showTextColor = false,
  textColor,
  effectiveTextColor,
  onTextColorChange,
  onClose,
  inline = false,
  embedded = false,
}: UnifiedColorPickerProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<ColorTab>("background");

  useEffect(() => {
    if (inline || !onClose) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [inline, onClose]);

  const showCustom = mode !== "preset-only";
  const activeColor =
    activeTab === "background"
      ? color
      : (textColor ?? effectiveTextColor ?? "");

  const handleSelect = (c: string) => {
    if (activeTab === "background") onChange(c);
    else onTextColorChange?.(c);
  };

  const content = (
    <div className="p-2">
      {showTextColor && (
        <div className="flex border-b border-notion-border -mx-2 -mt-2 mb-1.5 px-2">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setActiveTab("background")}
            className={`flex-1 py-1 text-[10px] font-medium transition-colors ${
              activeTab === "background"
                ? "text-notion-accent border-b-2 border-notion-accent -mb-px"
                : "text-notion-text-secondary hover:text-notion-text"
            }`}
          >
            {t("colorPicker.backgroundColor", "Background")}
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setActiveTab("text")}
            className={`flex-1 py-1 text-[10px] font-medium transition-colors ${
              activeTab === "text"
                ? "text-notion-accent border-b-2 border-notion-accent -mb-px"
                : "text-notion-text-secondary hover:text-notion-text"
            }`}
          >
            {t("colorPicker.textColor", "Text")}
          </button>
        </div>
      )}

      <div className="grid grid-cols-6 gap-1.5 justify-items-center">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSelect(preset)}
            className="relative w-6 h-6 rounded-full ring-1 ring-notion-border hover:scale-110 transition-transform"
            style={{ backgroundColor: preset }}
            aria-label={preset}
          >
            {activeColor === preset && (
              <Check
                size={14}
                className="absolute inset-0 m-auto text-white"
                strokeWidth={3}
              />
            )}
          </button>
        ))}
      </div>

      {(showCustom ||
        (showTextColor && activeTab === "text" && !!textColor)) && (
        <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-notion-border">
          {showCustom ? (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="color"
                value={
                  activeColor && /^#[0-9a-fA-F]{6}$/.test(activeColor)
                    ? activeColor
                    : "#808080"
                }
                onChange={(e) => handleSelect(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border border-notion-border"
                aria-label={t("colorPicker.custom", "Custom")}
              />
              <span className="text-[10px] text-notion-text-secondary">
                {t("colorPicker.custom", "Custom")}
              </span>
            </label>
          ) : (
            <span />
          )}

          {showTextColor && activeTab === "text" && textColor && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onTextColorChange?.(undefined)}
              className="text-[10px] text-notion-text-secondary hover:text-notion-text"
            >
              {t("colorPicker.default", "Default")}
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (inline) {
    return (
      <div
        ref={ref}
        className={
          embedded
            ? "w-full"
            : "bg-notion-bg border border-notion-border rounded-md shadow-sm w-[190px]"
        }
      >
        {content}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-[9999] bg-notion-bg border border-notion-border rounded-md shadow-lg w-[190px]"
    >
      {content}
    </div>
  );
}
