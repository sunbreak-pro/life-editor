interface ToggleSwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: "sm" | "default";
  className?: string;
}

const sizeMap = {
  sm: {
    track: "w-7 h-4",
    thumb: "top-0.5 left-0.5 w-3 h-3",
    translate: "translate-x-3",
  },
  default: {
    track: "w-9 h-5",
    thumb: "top-0.5 left-0.5 w-4 h-4",
    translate: "translate-x-4",
  },
} as const;

export function ToggleSwitch({
  checked,
  onChange,
  size = "default",
  className = "",
}: ToggleSwitchProps) {
  const s = sizeMap[size];
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative ${s.track} rounded-full transition-colors shrink-0 ${
        checked ? "bg-notion-accent" : "bg-notion-border"
      } ${className}`}
    >
      <span
        className={`absolute ${s.thumb} bg-white rounded-full transition-transform shadow-sm ${
          checked ? s.translate : ""
        }`}
      />
    </button>
  );
}
