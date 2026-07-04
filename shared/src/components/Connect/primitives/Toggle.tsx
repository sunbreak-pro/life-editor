import type { LucideIcon } from "lucide-react";

interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon?: LucideIcon;
}

export function Toggle({ label, value, onChange, icon: Icon }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={
        "w-full flex items-center justify-between px-2.5 py-2 rounded-md border transition-colors " +
        (value
          ? "bg-lumen-hover border-lumen-border"
          : "border-transparent hover:bg-lumen-hover")
      }
    >
      <span
        className={
          "flex items-center gap-2 text-[12px] " +
          (value ? "text-lumen-text" : "text-lumen-text-secondary")
        }
      >
        {Icon && <Icon size={13} />}
        {label}
      </span>
      <span
        className={
          "w-7 h-4 rounded-full relative transition-colors " +
          (value ? "bg-lumen-accent" : "bg-lumen-border")
        }
      >
        <span
          className="absolute top-0.5 w-3 h-3 rounded-full bg-lumen-bg transition-all"
          style={{ left: value ? "calc(100% - 14px)" : "2px" }}
        />
      </span>
    </button>
  );
}
