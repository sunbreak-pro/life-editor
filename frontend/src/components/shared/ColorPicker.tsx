import { useRef } from "react";
import { FOLDER_COLORS, getTextColorForBg } from "../../constants/folderColors";
import { Check } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";

interface ColorPickerProps {
  currentColor?: string;
  onSelect: (color: string) => void;
  onClose: () => void;
}

export function ColorPicker({
  currentColor,
  onSelect,
  onClose,
}: ColorPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);

  const pastelColors = FOLDER_COLORS.slice(0, 10);
  const vividColors = FOLDER_COLORS.slice(10);

  const renderSwatch = (color: string) => {
    const isSelected = currentColor === color;
    return (
      <button
        key={color}
        onClick={() => {
          onSelect(color);
          onClose();
        }}
        className="w-7 h-7 rounded-full flex items-center justify-center transition-shadow hover:ring-2 hover:ring-notion-text/30"
        style={{
          backgroundColor: color,
          boxShadow: isSelected
            ? `0 0 0 2px ${getTextColorForBg(color)}`
            : undefined,
        }}
      >
        {isSelected && (
          <Check size={12} style={{ color: getTextColorForBg(color) }} />
        )}
      </button>
    );
  };

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
