import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { History as HistoryIcon } from "lucide-react";
import { getDataService } from "../../services";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import type { TimerSession } from "../../types/timer";

interface DayBucket {
  dateKey: string;
  date: Date;
  sessions: TimerSession[];
  totalSeconds: number;
}

const RANGE_DAYS = 7;
const DEFAULT_RANGE_DAYS = 14;

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

function formatTimeOfDay(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayKeyOf(d: Date): string {
  return d.toISOString().substring(0, 10);
}

function sessionTypeLabel(type: string): string {
  switch (type) {
    case "WORK":
      return "Work";
    case "FREE":
      return "Free";
    case "BREAK":
      return "Break";
    case "LONG_BREAK":
      return "Long break";
    default:
      return type;
  }
}

function sessionAccent(type: string): string {
  switch (type) {
    case "WORK":
      return "bg-notion-accent";
    case "FREE":
      return "bg-purple-500";
    case "BREAK":
    case "LONG_BREAK":
      return "bg-blue-400";
    default:
      return "bg-notion-text-secondary";
  }
}

export function WorkHistoryContent() {
  const { t } = useTranslation();
  const { nodes } = useTaskTreeContext();
  const [sessions, setSessions] = useState<TimerSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDataService()
      .fetchTimerSessions()
      .then((rows) => {
        if (!cancelled) setSessions(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setSessions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const taskTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodes) m.set(n.id, n.title);
    return m;
  }, [nodes]);

  const buckets = useMemo<DayBucket[]>(() => {
    if (!sessions) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DEFAULT_RANGE_DAYS);
    const byDay = new Map<string, DayBucket>();
    for (const s of sessions) {
      // Only count completed real-work sessions (WORK / FREE) — break sessions
      // are noise in a "what did I do today" view.
      if (!s.completed) continue;
      if (s.sessionType !== "WORK" && s.sessionType !== "FREE") continue;
      const startedAt = s.startedAt ? new Date(s.startedAt) : null;
      if (!startedAt || isNaN(startedAt.getTime())) continue;
      if (startedAt < cutoff) continue;
      const key = dayKeyOf(startedAt);
      let bucket = byDay.get(key);
      if (!bucket) {
        bucket = {
          dateKey: key,
          date: new Date(
            startedAt.getFullYear(),
            startedAt.getMonth(),
            startedAt.getDate(),
          ),
          sessions: [],
          totalSeconds: 0,
        };
        byDay.set(key, bucket);
      }
      bucket.sessions.push(s);
      bucket.totalSeconds += s.duration ?? 0;
    }
    const list = Array.from(byDay.values());
    // Newest day first; within a day, newest session first.
    list.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    for (const b of list) {
      b.sessions.sort((a, b) => {
        const ta = new Date(a.startedAt).getTime();
        const tb = new Date(b.startedAt).getTime();
        return tb - ta;
      });
    }
    return list;
  }, [sessions]);

  const last7TotalSeconds = useMemo(() => {
    if (!sessions) return 0;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RANGE_DAYS);
    let total = 0;
    for (const s of sessions) {
      if (!s.completed) continue;
      if (s.sessionType !== "WORK" && s.sessionType !== "FREE") continue;
      const startedAt = s.startedAt ? new Date(s.startedAt) : null;
      if (!startedAt || startedAt < cutoff) continue;
      total += s.duration ?? 0;
    }
    return total;
  }, [sessions]);

  if (sessions === null) {
    return (
      <div className="py-8 text-center text-sm text-notion-text-secondary">
        {t("common.loading", "Loading…")}
      </div>
    );
  }

  return (
    <div className="py-4 space-y-4">
      {/* Range summary */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-notion-bg-secondary border border-notion-border">
        <HistoryIcon size={16} className="text-notion-text-secondary" />
        <div className="flex-1">
          <div className="text-xs text-notion-text-secondary">
            {t("work.history.last7Days", "Last 7 days")}
          </div>
          <div className="text-sm font-medium text-notion-text">
            {formatDuration(last7TotalSeconds)}
          </div>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 text-xs text-red-500 break-words">
          {error}
        </div>
      )}

      {buckets.length === 0 ? (
        <div className="py-8 text-center text-sm text-notion-text-secondary">
          {t(
            "work.history.empty",
            "No recorded sessions yet. Start a Pomodoro or Free session to begin.",
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {buckets.map((b) => (
            <DaySection
              key={b.dateKey}
              bucket={b}
              taskTitleById={taskTitleById}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface DaySectionProps {
  bucket: DayBucket;
  taskTitleById: Map<string, string>;
}

function DaySection({ bucket, taskTitleById }: DaySectionProps) {
  const dateLabel = bucket.date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
  return (
    <div>
      <div className="flex items-center justify-between px-3 pb-1.5 border-b border-notion-border/60">
        <div className="text-xs font-medium text-notion-text">{dateLabel}</div>
        <div className="text-[11px] text-notion-text-secondary tabular-nums">
          {bucket.sessions.length} ·{" "}
          <span className="font-medium text-notion-text">
            {formatDuration(bucket.totalSeconds)}
          </span>
        </div>
      </div>
      <ul className="divide-y divide-notion-border/60">
        {bucket.sessions.map((s) => {
          const title =
            s.label ??
            (s.taskId ? (taskTitleById.get(s.taskId) ?? s.taskId) : null) ??
            (s.sessionType === "FREE" ? "Free session" : "Untitled");
          const startedAt = new Date(s.startedAt);
          return (
            <li
              key={s.id}
              className="flex items-center gap-3 px-3 py-2 hover:bg-notion-hover/40"
            >
              <span
                className={`shrink-0 w-1.5 h-1.5 rounded-full ${sessionAccent(s.sessionType)}`}
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <div className="truncate text-xs text-notion-text">{title}</div>
                <div className="text-[10px] text-notion-text-secondary tabular-nums">
                  {formatTimeOfDay(startedAt)} ·{" "}
                  {sessionTypeLabel(s.sessionType)}
                </div>
              </div>
              <div className="shrink-0 text-xs tabular-nums text-notion-text">
                {formatDuration(s.duration ?? 0)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
