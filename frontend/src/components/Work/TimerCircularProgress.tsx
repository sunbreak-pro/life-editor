import type { ReactNode } from "react";
import type { SessionType } from "../../types/timer";

interface TimerCircularProgressProps {
  progress: number;
  sessionType: SessionType;
  children: ReactNode;
}

const RADIUS = 180;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_ANGLE = 270;
const ARC_LENGTH = (ARC_ANGLE / 360) * CIRCUMFERENCE;
const GAP_LENGTH = CIRCUMFERENCE - ARC_LENGTH;
const START_ROTATION = 135;

export function TimerCircularProgress({
  progress,
  sessionType,
  children,
}: TimerCircularProgressProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  const progressLength = (clamped / 100) * ARC_LENGTH;

  const progressColor =
    sessionType === "WORK" ? "text-notion-accent" : "text-notion-success";

  return (
    <div className="relative flex items-center justify-center w-96 h-96">
      <svg className="absolute inset-0" viewBox="0 0 400 400">
        <circle
          cx="200"
          cy="200"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          className="text-notion-border"
          strokeDasharray={`${ARC_LENGTH} ${GAP_LENGTH}`}
          transform={`rotate(${START_ROTATION} 200 200)`}
        />
        <circle
          cx="200"
          cy="200"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          className={progressColor}
          strokeDasharray={`${progressLength} ${CIRCUMFERENCE - progressLength}`}
          transform={`rotate(${START_ROTATION} 200 200)`}
          style={{ transition: "stroke-dasharray 1s linear" }}
        />
      </svg>
      <div className="z-10 flex flex-col items-center">{children}</div>
    </div>
  );
}
