interface TaskNodeTimerProps {
  isActive: boolean;
  remainingSeconds: number;
  formatTime: (seconds: number) => string;
}

export function TaskNodeTimer({
  isActive,
  remainingSeconds,
  formatTime,
}: TaskNodeTimerProps) {
  if (!isActive) return null;

  return (
    <span className="text-xs font-mono tabular-nums text-notion-accent shrink-0">
      {formatTime(remainingSeconds)}
    </span>
  );
}

interface TaskNodeTimerBarProps {
  isActive: boolean;
  progress: number;
  depth: number;
}

export function TaskNodeTimerBar({
  isActive,
  progress,
  depth,
}: TaskNodeTimerBarProps) {
  if (!isActive) return null;

  return (
    <div
      className="h-0.5 bg-notion-border rounded-full overflow-hidden"
      style={{ marginLeft: `${depth * 20 + 32}px`, marginRight: "8px" }}
    >
      <div
        className="h-full bg-notion-accent transition-all duration-1000 ease-linear rounded-full"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
