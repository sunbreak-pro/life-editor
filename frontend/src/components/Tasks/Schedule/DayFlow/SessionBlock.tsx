import type { TimerSession } from "../../../../types/timer";
import { TIME_GRID } from "../../../../constants/timeGrid";

interface SessionBlockProps {
  session: TimerSession;
  taskTitle?: string;
}

const SESSION_COLORS: Record<string, string> = {
  WORK: "bg-rose-400/45 border-rose-500/50",
  BREAK: "bg-emerald-400/35 border-emerald-500/45",
  LONG_BREAK: "bg-sky-400/35 border-sky-500/45",
  FREE: "bg-violet-400/35 border-violet-500/45",
};

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  return typeof v === "string" ? new Date(v) : v;
}

export function SessionBlock({ session, taskTitle }: SessionBlockProps) {
  const startedAt = toDate(session.startedAt);
  if (!startedAt || Number.isNaN(startedAt.getTime())) return null;

  const startMinutes = startedAt.getHours() * 60 + startedAt.getMinutes();
  const top =
    (startMinutes / 60 - TIME_GRID.START_HOUR) * TIME_GRID.SLOT_HEIGHT;

  let durationSeconds = 0;
  if (session.duration && session.duration > 0) {
    durationSeconds = session.duration;
  } else {
    const completedAt = toDate(session.completedAt);
    if (completedAt) {
      durationSeconds = (completedAt.getTime() - startedAt.getTime()) / 1000;
    }
  }
  if (durationSeconds <= 0) return null;

  const heightPx = (durationSeconds / 60 / 60) * TIME_GRID.SLOT_HEIGHT;
  const height = Math.max(heightPx, 4);

  const color =
    SESSION_COLORS[session.sessionType] ?? "bg-gray-400/30 border-gray-500/40";
  const durationMin = Math.max(1, Math.round(durationSeconds / 60));
  const label =
    session.label?.trim() ||
    taskTitle ||
    (session.sessionType === "WORK"
      ? "Work"
      : session.sessionType === "BREAK"
        ? "Break"
        : session.sessionType === "LONG_BREAK"
          ? "Long break"
          : "Free");

  const startTimeStr = `${String(startedAt.getHours()).padStart(2, "0")}:${String(
    startedAt.getMinutes(),
  ).padStart(2, "0")}`;

  return (
    <div
      className={`absolute pointer-events-auto rounded-r border-l-2 ${color} cursor-default`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: 0,
        width: "4px",
      }}
      title={`${label} • ${startTimeStr} • ${durationMin}m`}
    />
  );
}
