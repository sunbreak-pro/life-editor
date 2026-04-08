import { Flag } from "lucide-react";
import type { Priority } from "../../types/priority";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "../../types/priority";

interface PriorityBadgeProps {
  priority: Priority;
  size?: number;
  showLabel?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export function PriorityBadge({
  priority,
  size = 14,
  showLabel = false,
  onClick,
}: PriorityBadgeProps) {
  const color = PRIORITY_COLORS[priority];
  const label = PRIORITY_LABELS[priority];

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${onClick ? "cursor-pointer hover:opacity-80" : ""}`}
      onClick={onClick}
      title={label}
    >
      <Flag size={size} style={{ color }} fill={color} />
      {showLabel && (
        <span className="text-xs font-medium" style={{ color }}>
          {label}
        </span>
      )}
    </span>
  );
}
