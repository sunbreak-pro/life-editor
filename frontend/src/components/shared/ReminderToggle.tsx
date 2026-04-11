import { Bell, BellOff } from "lucide-react";

const OFFSET_OPTIONS = [5, 10, 15, 30, 60, 120];

interface ReminderToggleProps {
  enabled: boolean;
  offset?: number;
  onEnabledChange: (enabled: boolean) => void;
  onOffsetChange: (offset: number) => void;
  label?: string;
  offsetLabel?: string;
  compact?: boolean;
}

export function ReminderToggle({
  enabled,
  offset = 30,
  onEnabledChange,
  onOffsetChange,
  label,
  offsetLabel,
  compact = false,
}: ReminderToggleProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onEnabledChange(!enabled)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
            enabled
              ? "bg-notion-accent/15 text-notion-accent"
              : "text-notion-text-secondary hover:bg-notion-bg-hover"
          }`}
          title={label}
        >
          {enabled ? <Bell size={13} /> : <BellOff size={13} />}
        </button>
        {enabled && (
          <select
            value={offset}
            onChange={(e) => onOffsetChange(Number(e.target.value))}
            className="text-xs bg-notion-bg-secondary border border-notion-border rounded px-1.5 py-0.5 text-notion-text"
          >
            {OFFSET_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m}min` : `${m / 60}h`}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-notion-text-secondary" />
          {label && <span className="text-sm text-notion-text">{label}</span>}
        </div>
        <button
          type="button"
          onClick={() => onEnabledChange(!enabled)}
          className={`relative w-9 h-[18px] rounded-full transition-colors cursor-pointer ${
            enabled ? "bg-notion-accent" : "bg-notion-border"
          }`}
        >
          <span
            className={`absolute top-[1px] left-[1px] w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
              enabled ? "translate-x-[18px]" : ""
            }`}
          />
        </button>
      </div>
      {enabled && (
        <div className="flex items-center justify-between ml-6">
          {offsetLabel && (
            <span className="text-xs text-notion-text-secondary">
              {offsetLabel}
            </span>
          )}
          <select
            value={offset}
            onChange={(e) => onOffsetChange(Number(e.target.value))}
            className="text-xs bg-notion-bg-secondary border border-notion-border rounded-md px-2 py-1 text-notion-text"
          >
            {OFFSET_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m}min` : `${m / 60}h`}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
