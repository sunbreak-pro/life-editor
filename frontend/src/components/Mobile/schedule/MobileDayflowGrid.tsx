import { useEffect, useMemo, useRef, useState } from "react";
import { Repeat } from "lucide-react";
import type { DayItem } from "./dayItem";
import { kindPalette } from "./chipPalette";

const HOUR_PX = 54;
const DAY_START = 5;
const DAY_END = 24;

function timeToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

interface MobileDayflowGridProps {
  dateStr: string;
  items: DayItem[];
  onEditEvent: (item: DayItem) => void;
}

export function MobileDayflowGrid({
  dateStr,
  items,
  onEditEvent,
}: MobileDayflowGridProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const todayStr = useMemo(() => formatDate(new Date()), []);
  const isToday = dateStr === todayStr;

  // Track current minute for "now" line (updates every 30s).
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    if (!isToday) return;
    const id = window.setInterval(() => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 30_000);
    return () => window.clearInterval(id);
  }, [isToday]);

  // Auto-scroll to current hour (today) or 08:00 on date change.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const targetHour = isToday ? Math.floor(nowMin / 60) : 8;
    const targetPx = Math.max(0, targetHour - DAY_START - 1) * HOUR_PX;
    el.scrollTop = targetPx;
    // intentionally omit nowMin — only scroll on date change / mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr, isToday]);

  // Exclude all-day events from the grid; they have no meaningful position.
  const timedItems = items.filter(
    (it) => !(it.kind === "event" && it.isAllDay),
  );

  const totalHours = DAY_END - DAY_START;
  const gridHeight = totalHours * HOUR_PX;

  const nowTopPx = ((nowMin - DAY_START * 60) / 60) * HOUR_PX;
  const showNow = isToday && nowMin >= DAY_START * 60 && nowMin <= DAY_END * 60;

  const hours: number[] = [];
  for (let h = DAY_START; h <= DAY_END; h++) hours.push(h);

  return (
    <div
      ref={scrollRef}
      className="relative flex-1 overflow-y-auto bg-notion-bg"
    >
      <div
        className="relative"
        style={{ height: gridHeight, paddingLeft: 48, paddingRight: 12 }}
      >
        {/* Hour rows */}
        {hours.map((h) => (
          <div
            key={h}
            className="absolute inset-x-0 border-t border-notion-border"
            style={{ top: (h - DAY_START) * HOUR_PX, height: HOUR_PX }}
          >
            <div
              className="absolute w-[38px] bg-notion-bg pr-1 text-right text-[10px] font-medium text-notion-text-secondary"
              style={{ left: 6, top: -7, opacity: 0.85 }}
            >
              {h === 24 ? "0:00" : `${h}:00`}
            </div>
            <div
              className="absolute right-0 border-t border-dashed border-notion-border opacity-60"
              style={{ left: 48, top: HOUR_PX / 2 }}
            />
          </div>
        ))}

        {/* Event blocks */}
        {timedItems.map((item) => {
          const startMin = timeToMin(item.start);
          const endMin = timeToMin(item.end);
          const top = ((startMin - DAY_START * 60) / 60) * HOUR_PX;
          const height = Math.max(22, ((endMin - startMin) / 60) * HOUR_PX - 2);
          const palette = kindPalette(item.kind);
          return (
            <button
              key={item.id}
              onClick={() => onEditEvent(item)}
              className="absolute flex cursor-pointer flex-col overflow-hidden rounded-lg text-left"
              style={{
                left: 52,
                right: 6,
                top,
                height,
                background: palette.bg,
                borderLeft: `3px solid ${palette.dot}`,
                padding: "4px 8px 4px 9px",
              }}
            >
              <div className="flex min-w-0 items-center gap-1 text-xs font-semibold text-notion-text">
                {item.kind === "routine" && (
                  <Repeat size={11} style={{ color: palette.dot }} />
                )}
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {item.title}
                </span>
              </div>
              {height > 34 && (
                <div className="text-[10px] font-medium text-notion-text-secondary">
                  {item.start} – {item.end}
                </div>
              )}
            </button>
          );
        })}

        {/* Now line */}
        {showNow && (
          <div
            className="pointer-events-none absolute right-0 z-20"
            style={{ left: 40, top: nowTopPx, height: 0 }}
          >
            <div
              className="absolute h-[9px] w-[9px] rounded-full bg-red-500"
              style={{
                left: 0,
                top: -4,
                boxShadow: "0 0 0 3px rgba(239,68,68,0.18)",
              }}
            />
            <div
              className="absolute border-t-[1.5px] border-red-500"
              style={{ left: 9, right: 0, top: 0 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
