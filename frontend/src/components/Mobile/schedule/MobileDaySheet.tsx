import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Repeat } from "lucide-react";
import type { DayItem } from "./dayItem";
import { kindPalette } from "./chipPalette";

const DRAG_THRESHOLD = 40;

interface MobileDaySheetProps {
  dateStr: string;
  items: DayItem[];
  expanded: boolean;
  isToday: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onCollapse: () => void;
  onEditEvent: (item: DayItem) => void;
  onToggleScheduleComplete: (id: string) => void;
  onToggleTask: (item: DayItem) => void;
  onAddItem: () => void;
}

function dayOfWeekJa(date: Date): string {
  return ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
}

function dayOfWeekColor(date: Date): string {
  const dow = date.getDay();
  if (dow === 0) return "text-red-500";
  if (dow === 6) return "text-red-400";
  return "text-notion-text-secondary";
}

export function MobileDaySheet({
  dateStr,
  items,
  expanded,
  isToday,
  onToggle,
  onExpand,
  onCollapse,
  onEditEvent,
  onToggleScheduleComplete,
  onToggleTask,
  onAddItem,
}: MobileDaySheetProps) {
  const { t } = useTranslation();
  const date = new Date(dateStr + "T00:00:00");

  const [dragDy, setDragDy] = useState<number | null>(null);
  const startYRef = useRef(0);

  const handleDragStart = useCallback((clientY: number) => {
    startYRef.current = clientY;
    setDragDy(0);
  }, []);

  const handleDragMove = useCallback((clientY: number) => {
    setDragDy(clientY - startYRef.current);
  }, []);

  const handleDragEnd = useCallback(() => {
    // Read current dragDy from closure (captured at render time). Side-effects
    // stay outside the state setter so React Strict Mode's double-invocation
    // never double-fires onExpand / onCollapse.
    if (dragDy != null) {
      if (dragDy < -DRAG_THRESHOLD && !expanded) onExpand();
      else if (dragDy > DRAG_THRESHOLD && expanded) onCollapse();
    }
    setDragDy(null);
  }, [dragDy, expanded, onExpand, onCollapse]);

  // Height: collapsed ~ 38dvh, expanded ~ 80dvh. While dragging, interpolate.
  const baseHeightVh = expanded ? 80 : 38;
  const dragOffsetPx = dragDy ?? 0;
  const heightStyle: React.CSSProperties =
    dragDy != null
      ? { height: `calc(${baseHeightVh}dvh - ${dragOffsetPx}px)` }
      : { height: `${baseHeightVh}dvh` };

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-2xl bg-notion-bg shadow-[0_-10px_30px_rgba(15,23,42,0.10),0_-1px_0_rgba(15,23,42,0.04)]"
      style={{
        ...heightStyle,
        transition:
          dragDy != null ? "none" : "height 280ms cubic-bezier(.2,.8,.2,1)",
      }}
    >
      {/* Drag handle */}
      <button
        onClick={onToggle}
        onMouseDown={(e) => handleDragStart(e.clientY)}
        onMouseMove={(e) => {
          if (dragDy != null) handleDragMove(e.clientY);
        }}
        onMouseUp={handleDragEnd}
        onMouseLeave={() => {
          if (dragDy != null) handleDragEnd();
        }}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
        onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
        onTouchEnd={handleDragEnd}
        className="flex shrink-0 cursor-grab touch-none justify-center py-2"
        aria-label="Toggle day sheet"
      >
        <div className="h-[5px] w-9 rounded-[3px] bg-notion-border" />
      </button>

      {/* Header */}
      <div className="flex shrink-0 items-baseline gap-2.5 px-[18px] pb-3 pt-0.5">
        <span
          className={`text-[28px] font-bold leading-none tracking-tight ${
            isToday ? "text-notion-accent" : "text-notion-text"
          }`}
        >
          {date.getDate()}
        </span>
        <span className={`text-sm font-semibold ${dayOfWeekColor(date)}`}>
          {dayOfWeekJa(date)}
        </span>
        <span className="text-[13px] text-notion-text-secondary">
          {isToday ? t("mobile.schedule.daySheet.todayPrefix", "Today · ") : ""}
          {t("mobile.calendar.itemCount", "{{count}} items", {
            count: items.length,
          })}
        </span>
        <div className="flex-1" />
        <button
          onClick={onAddItem}
          className="cursor-pointer text-[13px] font-medium text-notion-accent active:opacity-60"
        >
          {t("mobile.schedule.daySheet.edit", "Edit")}
        </button>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto pb-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12">
            <Clock size={32} className="text-notion-text-secondary/40" />
            <p className="text-sm text-notion-text-secondary">
              {t("mobile.schedule.daySheet.empty", "No events for this day")}
            </p>
            <button
              onClick={onAddItem}
              className="mt-2 rounded-lg bg-notion-accent px-4 py-2 text-sm font-medium text-white active:opacity-80"
            >
              {t("mobile.schedule.addFirst", "Add item")}
            </button>
          </div>
        ) : (
          items.map((item) => (
            <DaySheetRow
              key={item.id}
              item={item}
              onEdit={onEditEvent}
              onToggleComplete={() => {
                if (item.kind === "task") onToggleTask(item);
                else onToggleScheduleComplete(item.id);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface DaySheetRowProps {
  item: DayItem;
  onEdit: (item: DayItem) => void;
  onToggleComplete: () => void;
}

function DaySheetRow({ item, onEdit, onToggleComplete }: DaySheetRowProps) {
  const palette = kindPalette(item.kind);
  const done = item.kind === "task" ? item.status === "DONE" : item.completed;
  const isAllDay = item.kind === "event" && item.isAllDay;
  return (
    <div
      className="flex items-stretch gap-3 px-[18px] py-2"
      onClick={() => onEdit(item)}
    >
      {/* Time column */}
      <div className="flex w-10 shrink-0 flex-col pt-2 text-right text-[11px] leading-snug text-notion-text-secondary">
        {isAllDay ? (
          <div className="text-notion-text/80">—</div>
        ) : (
          <>
            <div className="font-semibold text-notion-text">{item.start}</div>
            <div className="opacity-70">{item.end}</div>
          </>
        )}
      </div>

      {/* Color rail */}
      <div
        className="my-1.5 w-[3px] shrink-0 rounded-[2px]"
        style={{ background: palette.dot }}
      />

      {/* Card */}
      <div
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-3 py-2"
        style={{ background: palette.bg }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete();
          }}
          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition-colors ${
            done ? "border-notion-accent bg-notion-accent" : ""
          }`}
          style={{
            borderColor: done ? undefined : palette.dot,
          }}
          aria-label="Toggle complete"
        >
          {done && (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 7L6 10L11 4"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm font-medium text-notion-text">
            {item.kind === "routine" && (
              <Repeat size={11} style={{ color: palette.dot }} />
            )}
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">
              {item.title}
            </span>
          </div>
        </div>
        <div
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: palette.fg }}
        >
          {item.kind}
        </div>
      </div>
    </div>
  );
}
