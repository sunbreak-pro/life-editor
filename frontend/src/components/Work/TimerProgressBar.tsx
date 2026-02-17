interface TimerProgressBarProps {
  progress: number;
}

export function TimerProgressBar({ progress }: TimerProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="relative w-full py-1.5">
      <div className="w-full h-1 bg-notion-border rounded-full overflow-hidden">
        <div
          className="h-full bg-notion-accent transition-all duration-1000 ease-linear rounded-full"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      <div
        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-notion-accent rounded-full shadow-sm border-2 border-notion-bg transition-all duration-1000 ease-linear"
        style={{ left: `calc(${clampedProgress}% - 6px)` }}
      />
    </div>
  );
}
