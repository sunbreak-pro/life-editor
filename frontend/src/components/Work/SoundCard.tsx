import { X, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SoundCardProps {
  label: string;
  icon: LucideIcon;
  enabled: boolean;
  volume: number;
  onToggle: () => void;
  onVolumeChange: (volume: number) => void;
  onDelete?: () => void;
  currentTime?: number;
  duration?: number;
  onSeek?: (time: number) => void;
}

function formatSeekTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SoundCard({
  label,
  icon: Icon,
  enabled,
  volume,
  onToggle,
  onVolumeChange,
  onDelete,
  currentTime,
  duration,
  onSeek,
}: SoundCardProps) {
  const showSeek = enabled && onSeek && duration !== undefined && duration > 0;
  return (
    <div
      className={`relative flex flex-col items-center gap-3 p-4 rounded-lg border transition-colors cursor-pointer ${
        enabled
          ? "border-notion-accent bg-notion-accent/10"
          : "border-notion-border bg-notion-bg-secondary hover:border-notion-text-secondary"
      }`}
      onClick={onToggle}
    >
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-1 right-1 p-0.5 rounded hover:bg-notion-hover text-notion-text-secondary hover:text-notion-text transition-colors"
        >
          <X size={12} />
        </button>
      )}
      <Icon
        size={24}
        className={
          enabled ? "text-notion-accent" : "text-notion-text-secondary"
        }
      />
      <span
        className={`text-xs font-medium truncate max-w-full ${enabled ? "text-notion-accent" : "text-notion-text-secondary"}`}
      >
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={volume}
        onChange={(e) => {
          e.stopPropagation();
          onVolumeChange(Number(e.target.value));
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-full h-1 accent-[--color-accent] cursor-pointer"
        disabled={!enabled}
      />
      {showSeek && (
        <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
          <Clock size={10} className="text-notion-text-secondary shrink-0" />
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={currentTime ?? 0}
            onChange={(e) => {
              e.stopPropagation();
              onSeek(Number(e.target.value));
            }}
            className="w-full h-1 accent-[--color-text-secondary] cursor-pointer"
          />
          <span className="text-[9px] text-notion-text-secondary tabular-nums shrink-0">
            {formatSeekTime(currentTime ?? 0)}
          </span>
        </div>
      )}
    </div>
  );
}
