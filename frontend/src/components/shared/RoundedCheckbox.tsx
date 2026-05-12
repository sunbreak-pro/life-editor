import { Check } from "lucide-react";

export type RoundedCheckboxVariant = "complete" | "accent";

interface RoundedCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: number;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  variant?: RoundedCheckboxVariant;
  stopPropagation?: boolean;
}

const VARIANT_CHECKED: Record<RoundedCheckboxVariant, string> = {
  complete: "bg-green-500 border-green-500 text-white",
  accent: "bg-notion-accent border-notion-accent text-white",
};

export function RoundedCheckbox({
  checked,
  onChange,
  size = 16,
  className = "",
  disabled = false,
  ariaLabel,
  variant = "complete",
  stopPropagation = true,
}: RoundedCheckboxProps) {
  const iconSize = Math.round(size * 0.7);

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        if (disabled) return;
        onChange(!checked);
      }}
      className={`shrink-0 rounded-sm border transition-colors flex items-center justify-center ${
        disabled ? "opacity-40 cursor-not-allowed " : ""
      }${
        checked
          ? VARIANT_CHECKED[variant]
          : "border-notion-border hover:border-notion-text-secondary bg-transparent"
      } ${className}`}
      style={{ width: size, height: size }}
    >
      {checked && <Check size={iconSize} strokeWidth={3} />}
    </button>
  );
}
