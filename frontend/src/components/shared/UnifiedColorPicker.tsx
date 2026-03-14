import { useState, useRef, useCallback, useEffect } from "react";
import { HexColorPicker, HexColorInput } from "react-colorful";
import { DEFAULT_PRESET_COLORS } from "../../constants/folderColors";
import { useClickOutside } from "../../hooks/useClickOutside";
import { useTranslation } from "react-i18next";

interface UnifiedColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  mode?: "preset-only" | "preset-full";
  presets?: readonly string[];
  showTextColor?: boolean;
  textColor?: string;
  effectiveTextColor?: string;
  onTextColorChange?: (color: string | undefined) => void;
  onClose?: () => void;
  inline?: boolean;
}

type ColorTab = "background" | "text";

export function UnifiedColorPicker({
  color,
  onChange,
  mode = "preset-full",
  presets = DEFAULT_PRESET_COLORS,
  showTextColor = false,
  textColor,
  effectiveTextColor,
  onTextColorChange,
  onClose,
  inline = false,
}: UnifiedColorPickerProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<ColorTab>("background");

  useClickOutside(ref, () => onClose?.(), !inline && !!onClose);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const onTextColorChangeRef = useRef(onTextColorChange);
  useEffect(() => {
    onTextColorChangeRef.current = onTextColorChange;
  }, [onTextColorChange]);

  const activeColor =
    activeTab === "background"
      ? color
      : (textColor ?? effectiveTextColor ?? "");
  const handleColorChange = useCallback(
    (newColor: string) => {
      if (activeTab === "background") {
        onChangeRef.current(newColor);
      } else {
        onTextColorChangeRef.current?.(newColor);
      }
    },
    [activeTab],
  );

  if (mode === "preset-only") {
    return (
      <div className="flex items-center gap-1 p-1">
        <button
          type="button"
          onClick={() => onChange("")}
          className={`w-5 h-5 rounded-full border border-notion-border flex items-center justify-center text-[9px] font-medium text-notion-text-secondary ${
            !color ? "ring-1 ring-notion-text" : ""
          }`}
          title={t("colorPicker.default")}
        >
          A
        </button>
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className={`w-5 h-5 rounded-full transition-transform ${
              color === preset ? "ring-1 ring-notion-text" : ""
            }`}
            style={{ backgroundColor: preset }}
          />
        ))}
      </div>
    );
  }

  const content = (
    <div className="unified-color-picker">
      {showTextColor && (
        <div className="border-b border-notion-border">
          <div className="flex">
            <button
              type="button"
              onClick={() => setActiveTab("background")}
              className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${
                activeTab === "background"
                  ? "text-notion-accent border-b-2 border-notion-accent"
                  : "text-notion-text-secondary hover:text-notion-text"
              }`}
            >
              {t("colorPicker.backgroundColor")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("text")}
              className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${
                activeTab === "text"
                  ? "text-notion-accent border-b-2 border-notion-accent"
                  : "text-notion-text-secondary hover:text-notion-text"
              }`}
            >
              {t("colorPicker.textColor")}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => handleColorChange(preset)}
            className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
              activeColor === preset
                ? "ring-2 ring-notion-text ring-offset-1 ring-offset-notion-bg"
                : ""
            }`}
            style={{ backgroundColor: preset }}
          />
        ))}
      </div>

      <div className="px-2 pt-1.5 pb-2">
        <HexColorPicker
          color={activeColor || "#808080"}
          onChange={handleColorChange}
        />
      </div>

      <div className="flex items-center gap-2 px-2 pb-2">
        <span className="text-[10px] text-notion-text-secondary font-medium">
          {t("colorPicker.hexLabel")}
        </span>
        <div className="flex items-center gap-1.5 flex-1">
          <div
            className="w-4 h-4 rounded border border-notion-border shrink-0"
            style={{ backgroundColor: activeColor || "#808080" }}
          />
          <HexColorInput
            color={activeColor || "#808080"}
            onChange={handleColorChange}
            prefixed
            className="w-full text-xs bg-notion-bg-secondary border border-notion-border rounded px-1.5 py-0.5 text-notion-text font-mono outline-none focus:border-notion-accent"
          />
        </div>
      </div>

      {showTextColor && activeTab === "text" && textColor && (
        <div className="px-2 pb-2">
          <button
            type="button"
            onClick={() => onTextColorChange?.(undefined)}
            className="text-[10px] text-notion-text-secondary hover:text-notion-text"
          >
            {t("colorPicker.default")}
          </button>
        </div>
      )}
    </div>
  );

  if (inline) {
    return <div ref={ref}>{content}</div>;
  }

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-50 bg-notion-bg border border-notion-border rounded-lg shadow-lg w-52 overflow-hidden"
    >
      {content}
    </div>
  );
}
