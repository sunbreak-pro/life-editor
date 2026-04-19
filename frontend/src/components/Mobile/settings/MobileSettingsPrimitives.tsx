import type { ReactNode } from "react";

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div className="border-b border-notion-border">
      <div className="px-4 pb-1 pt-4">
        <span className="text-[11px] font-medium uppercase tracking-wider text-notion-text-secondary">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

interface PillOptionProps {
  icon?: ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export function PillOption({
  icon,
  label,
  isActive,
  onClick,
}: PillOptionProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border-2 py-2.5 text-[13px] font-medium transition-colors ${
        isActive
          ? "border-notion-accent bg-notion-accent/10 text-notion-accent"
          : "border-notion-border text-notion-text-secondary active:bg-notion-hover"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled,
  ariaLabel,
}: ToggleSwitchProps) {
  const handleToggle = () => {
    if (!disabled) onChange(!checked);
  };
  return (
    <label
      className={`flex items-center gap-3 ${disabled ? "opacity-50" : ""}`}
    >
      <div
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        onClick={handleToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          disabled ? "cursor-not-allowed" : "cursor-pointer"
        } ${checked ? "bg-notion-accent" : "bg-notion-text-secondary/30"}`}
      >
        <div
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </div>
      {label && <span className="text-[13px] text-notion-text">{label}</span>}
    </label>
  );
}

interface CompactButtonProps {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "secondary" | "accent" | "danger";
}

export function CompactButton({
  icon,
  label,
  onClick,
  disabled,
  variant = "secondary",
}: CompactButtonProps) {
  const base =
    "flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors disabled:opacity-50";
  const variants: Record<string, string> = {
    secondary:
      "border-notion-border text-notion-text-secondary active:bg-notion-hover",
    accent:
      "border-notion-accent bg-notion-accent/10 text-notion-accent active:bg-notion-accent/20",
    danger:
      "border-notion-danger text-notion-danger active:bg-notion-danger/10",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]}`}
    >
      {icon}
      {label}
    </button>
  );
}
