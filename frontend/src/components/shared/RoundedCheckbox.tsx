import { Check } from "lucide-react";

interface RoundedCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: number;
  className?: string;
}

export function RoundedCheckbox({
  checked,
  onChange,
  size = 16,
  className = "",
}: RoundedCheckboxProps) {
  const iconSize = Math.round(size * 0.7);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`shrink-0 rounded-sm border transition-colors flex items-center justify-center ${
        checked
          ? "bg-green-500 border-green-500 text-white"
          : "border-notion-border hover:border-notion-text-secondary bg-transparent"
      } ${className}`}
      style={{ width: size, height: size }}
    >
      {checked && <Check size={iconSize} strokeWidth={3} />}
    </button>
  );
}
