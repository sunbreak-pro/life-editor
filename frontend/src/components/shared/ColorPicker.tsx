import { useRef } from "react";
import { FOLDER_COLORS, getTextColorForBg } from "../../constants/folderColors";
import { Check } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";

interface InlineColorPickerProps {
  colors: readonly string[];
  selectedColor: string;
  onSelect: (color: string) => void;
  size?: "sm" | "md";
}

export function InlineColorPicker({
  colors,
  selectedColor,
  onSelect,
  size = "md",
}: InlineColorPickerProps) {
  const sizeClass = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  return (
    <div className="flex gap-1">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onSelect(color)}
          className={`${sizeClass} rounded-full transition-transform ${
            selectedColor === color ? "ring-1 ring-notion-text" : ""
          }`}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

interface ColorPickerProps {
  currentColor?: string;
  onSelect: (color: string) => void;
  onClose: () => void;
  inline?: boolean;
}

export function ColorPicker({
  currentColor,
  onSelect,
  onClose,
  inline,
}: ColorPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose, !inline);

  const pastelColors = FOLDER_COLORS.slice(0, 10);
  const vividColors = FOLDER_COLORS.slice(10);

  const renderSwatch = (color: string) => {
    const isSelected = currentColor === color;
    const swatchSize = inline ? "w-5 h-5" : "w-7 h-7";
    return (
      <button
        key={color}
        onClick={() => {
          onSelect(color);
          if (!inline) onClose();
        }}
        className={`${swatchSize} rounded-full flex items-center justify-center transition-shadow hover:ring-2 hover:ring-notion-text/30`}
        style={{
          backgroundColor: color,
          boxShadow: isSelected
            ? `0 0 0 ${inline ? "3" : "5"}px ${getTextColorForBg(color)}`
            : undefined,
        }}
      >
        {isSelected && (
          <Check
            size={inline ? 10 : 12}
            style={{ color: getTextColorForBg(color) }}
          />
        )}
      </button>
    );
  };

  if (inline) {
    return (
      <div>
        <p className="text-[10px] text-notion-text-secondary mb-1">Pastel</p>
        <div className="grid grid-cols-5 gap-1 mb-1.5">
          {pastelColors.map(renderSwatch)}
        </div>
        <p className="text-[10px] text-notion-text-secondary mb-1">Vivid</p>
        <div className="grid grid-cols-5 gap-1">
          {vividColors.map(renderSwatch)}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-50 bg-notion-bg border border-notion-border rounded-lg shadow-lg p-2 w-45"
    >
      <p className="text-[10px] text-notion-text-secondary mb-1 px-1">Pastel</p>
      <div className="grid grid-cols-5 gap-1.5 mb-2">
        {pastelColors.map(renderSwatch)}
      </div>
      <p className="text-[10px] text-notion-text-secondary mb-1 px-1">Vivid</p>
      <div className="grid grid-cols-5 gap-1.5">
        {vividColors.map(renderSwatch)}
      </div>
    </div>
  );
}
