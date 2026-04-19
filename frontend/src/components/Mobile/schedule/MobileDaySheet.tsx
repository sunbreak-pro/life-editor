import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Clock, Repeat, X } from "lucide-react";
import type { DayItem } from "./dayItem";
import { kindPalette } from "./chipPalette";
import { useRoutineContext } from "../../../hooks/useRoutineContext";
import { shouldRoutineRunOnDate } from "../../../utils/routineFrequency";
import type { RoutineGroup } from "../../../types/routineGroup";

const DRAG_THRESHOLD = 60;

export type SheetMode = "hidden" | "half" | "full";

const HALF_VH = 38;
const FULL_VH = 70;

interface MobileDaySheetProps {
  dateStr: string;
  items: DayItem[];
  mode: SheetMode;
  isToday: boolean;
  onChangeMode: (mode: SheetMode) => void;
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

interface GroupedSection {
  kind: "group";
  groupId: string;
  groupName: string;
  groupColor: string;
  items: DayItem[];
}
interface LooseSection {
  kind: "loose";
  items: DayItem[];
}
type Section = GroupedSection | LooseSection;

export function MobileDaySheet({
  dateStr,
  items,
  mode,
  isToday,
  onChangeMode,
  onEditEvent,
  onToggleScheduleComplete,
  onToggleTask,
  onAddItem,
}: MobileDaySheetProps) {
  const { t } = useTranslation();
  const date = new Date(dateStr + "T00:00:00");
  const { routineGroups, groupForRoutine } = useRoutineContext();

  const [dragDy, setDragDy] = useState<number | null>(null);
  const startYRef = useRef(0);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );

  const sections = useMemo<Section[]>(() => {
    const groupedMap = new Map<string, DayItem[]>();
    const loose: DayItem[] = [];
    for (const it of items) {
      let gid: string | undefined;
      if (it.kind === "routine" && it.source.routineId) {
        const gs = groupForRoutine.get(it.source.routineId);
        const g = gs?.find(
          (gg: RoutineGroup) =>
            gg.isVisible &&
            shouldRoutineRunOnDate(
              gg.frequencyType,
              gg.frequencyDays,
              gg.frequencyInterval,
              gg.frequencyStartDate,
              dateStr,
            ),
        );
        if (g) gid = g.id;
      }
      if (gid) {
        const arr = groupedMap.get(gid) ?? [];
        arr.push(it);
        groupedMap.set(gid, arr);
      } else {
        loose.push(it);
      }
    }
    const sorted = Array.from(groupedMap.entries()).sort(([a], [b]) => {
      const ga = routineGroups.find((g) => g.id === a);
      const gb = routineGroups.find((g) => g.id === b);
      return (ga?.order ?? 0) - (gb?.order ?? 0);
    });
    const result: Section[] = [];
    for (const [gid, grpItems] of sorted) {
      const g = routineGroups.find((r) => r.id === gid);
      if (!g) continue;
      result.push({
        kind: "group",
        groupId: gid,
        groupName: g.name,
        groupColor: g.color,
        items: grpItems,
      });
    }
    if (loose.length) result.push({ kind: "loose", items: loose });
    return result;
  }, [items, dateStr, groupForRoutine, routineGroups]);

  const toggleGroup = (gid: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else next.add(gid);
      return next;
    });
  };

  const handleDragStart = useCallback((clientY: number) => {
    startYRef.current = clientY;
    setDragDy(0);
  }, []);

  const handleDragMove = useCallback((clientY: number) => {
    setDragDy(clientY - startYRef.current);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragDy != null) {
      // Drag up → promote; drag down → demote.
      if (dragDy < -DRAG_THRESHOLD) {
        if (mode === "hidden") onChangeMode("half");
        else if (mode === "half") onChangeMode("full");
      } else if (dragDy > DRAG_THRESHOLD) {
        if (mode === "full") onChangeMode("half");
        else if (mode === "half") onChangeMode("hidden");
      }
    }
    setDragDy(null);
  }, [dragDy, mode, onChangeMode]);

  if (mode === "hidden") return null;

  const baseHeightVh = mode === "full" ? FULL_VH : HALF_VH;
  const dragOffsetPx = dragDy ?? 0;
  const heightStyle: React.CSSProperties =
    dragDy != null
      ? { height: `calc(${baseHeightVh}svh - ${dragOffsetPx}px)` }
      : { height: `${baseHeightVh}svh` };

  const handleHandleTap = () => {
    // Handle tap toggles between half ↔ full; collapsing uses drag or backdrop.
    onChangeMode(mode === "full" ? "half" : "full");
  };

  return (
    <>
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
          onClick={handleHandleTap}
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
            {isToday
              ? t("mobile.schedule.daySheet.todayPrefix", "Today · ")
              : ""}
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
          <button
            onClick={() => onChangeMode("hidden")}
            aria-label="Close"
            className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-notion-text-secondary active:bg-notion-hover"
          >
            <X size={14} />
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
            sections.map((section, idx) => {
              if (section.kind === "loose") {
                return (
                  <div key={`loose-${idx}`}>
                    {section.items.map((item) => (
                      <DaySheetRow
                        key={item.id}
                        item={item}
                        onEdit={onEditEvent}
                        onToggleComplete={() => {
                          if (item.kind === "task") onToggleTask(item);
                          else onToggleScheduleComplete(item.id);
                        }}
                      />
                    ))}
                  </div>
                );
              }
              const collapsed = collapsedGroups.has(section.groupId);
              return (
                <div
                  key={section.groupId}
                  className="mx-3 my-2 overflow-hidden rounded-lg"
                  style={{
                    border: `2px solid ${section.groupColor}80`,
                    background: `${section.groupColor}15`,
                  }}
                >
                  <button
                    onClick={() => toggleGroup(section.groupId)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left"
                    style={{
                      backgroundColor: `${section.groupColor}40`,
                      borderBottom: collapsed
                        ? undefined
                        : `2px solid ${section.groupColor}50`,
                    }}
                  >
                    <ChevronDown
                      size={14}
                      style={{
                        color: section.groupColor,
                        transform: collapsed ? "rotate(-90deg)" : undefined,
                        transition: "transform 150ms",
                      }}
                    />
                    <span
                      className="flex-1 truncate text-[13px] font-semibold"
                      style={{ color: section.groupColor }}
                    >
                      {section.groupName}
                    </span>
                    <span
                      className="text-[11px] opacity-70"
                      style={{ color: section.groupColor }}
                    >
                      {section.items.length}
                    </span>
                  </button>
                  {!collapsed && (
                    <div className="py-1">
                      {section.items.map((item) => (
                        <DaySheetRow
                          key={item.id}
                          item={item}
                          onEdit={onEditEvent}
                          onToggleComplete={() => {
                            if (item.kind === "task") onToggleTask(item);
                            else onToggleScheduleComplete(item.id);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
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
