import { useEffect, useMemo, useRef, useState } from "react";
import { Repeat } from "lucide-react";
import type { DayItem } from "./dayItem";
import { kindPalette } from "./chipPalette";
import { GroupFrame } from "../../Tasks/Schedule/DayFlow/GroupFrame";
import { useRoutineContext } from "../../../hooks/useRoutineContext";
import { shouldRoutineRunOnDate } from "../../../utils/routineFrequency";
import type { RoutineGroup } from "../../../types/routineGroup";

const HOUR_PX = 54;
const DAY_START = 5;
const DAY_END = 24;
const GUTTER_LEFT = 48;
const GRID_RIGHT = 6;
const MIN_ITEM_HEIGHT = 22;
const GROUP_HEADER_HEIGHT = 22;

interface PlacedItem {
  item: DayItem;
  top: number;
  height: number;
  column: number;
  totalColumns: number;
  groupId?: string;
}

function timeToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minToHHMM(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Greedy column assignment for time-overlapping items.
 * Mirrors the logic used by the desktop ScheduleTimeGrid.
 */
function assignColumns(placed: PlacedItem[]): void {
  placed.sort((a, b) => a.top - b.top || a.height - b.height);
  const columnEnds: number[] = [];
  const groupIndex: number[] = new Array(placed.length);
  const overlapGroups: number[][] = [];

  for (let i = 0; i < placed.length; i++) {
    const it = placed[i];
    const itEnd = it.top + it.height;
    let col = 0;
    let placedFlag = false;
    for (; col < columnEnds.length; col++) {
      if (it.top >= columnEnds[col]) {
        it.column = col;
        columnEnds[col] = itEnd;
        placedFlag = true;
        break;
      }
    }
    if (!placedFlag) {
      it.column = columnEnds.length;
      columnEnds.push(itEnd);
    }

    // Find overlap group (any prior still overlapping with this item)
    let foundGroup = -1;
    for (let j = i - 1; j >= 0; j--) {
      const prev = placed[j];
      if (prev.top + prev.height <= it.top) continue;
      foundGroup = groupIndex[j];
      break;
    }
    if (foundGroup >= 0) {
      overlapGroups[foundGroup].push(i);
      groupIndex[i] = foundGroup;
    } else {
      groupIndex[i] = overlapGroups.length;
      overlapGroups.push([i]);
    }
  }

  for (const g of overlapGroups) {
    let maxCol = 0;
    for (const idx of g)
      if (placed[idx].column > maxCol) maxCol = placed[idx].column;
    const total = maxCol + 1;
    for (const idx of g) placed[idx].totalColumns = total;
  }
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
  const { routineGroups, groupForRoutine } = useRoutineContext();

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

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const targetHour = isToday ? Math.floor(nowMin / 60) : 8;
    const targetPx = Math.max(0, targetHour - DAY_START - 1) * HOUR_PX;
    el.scrollTop = targetPx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr, isToday]);

  const timedItems = useMemo(
    () => items.filter((it) => !(it.kind === "event" && it.isAllDay)),
    [items],
  );

  // Compute placed items + overlap columns
  const placedItems = useMemo<PlacedItem[]>(() => {
    const list: PlacedItem[] = timedItems.map((item) => {
      const startMin = timeToMin(item.start);
      const endMin = timeToMin(item.end);
      const top = ((startMin - DAY_START * 60) / 60) * HOUR_PX;
      const height = Math.max(
        MIN_ITEM_HEIGHT,
        ((endMin - startMin) / 60) * HOUR_PX - 2,
      );
      // Resolve group for routines
      let groupId: string | undefined;
      if (item.kind === "routine" && item.source.routineId) {
        const groups = groupForRoutine.get(item.source.routineId);
        const g = groups?.find(
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
        if (g) groupId = g.id;
      }
      return { item, top, height, column: 0, totalColumns: 1, groupId };
    });
    assignColumns(list);
    return list;
  }, [timedItems, dateStr, groupForRoutine]);

  // Build group frames (top, height, etc.) for grouped routines
  const groupFrames = useMemo(() => {
    if (!routineGroups.length)
      return [] as Array<{
        groupId: string;
        groupName: string;
        groupColor: string;
        top: number;
        height: number;
        itemCount: number;
        timeRange: string;
      }>;
    const byGroup = new Map<
      string,
      { group: RoutineGroup; minTop: number; maxBottom: number; count: number }
    >();
    for (const p of placedItems) {
      if (!p.groupId) continue;
      const group = routineGroups.find((g) => g.id === p.groupId);
      if (!group) continue;
      const bottom = p.top + p.height;
      const existing = byGroup.get(group.id);
      if (existing) {
        existing.minTop = Math.min(existing.minTop, p.top);
        existing.maxBottom = Math.max(existing.maxBottom, bottom);
        existing.count += 1;
      } else {
        byGroup.set(group.id, {
          group,
          minTop: p.top,
          maxBottom: bottom,
          count: 1,
        });
      }
    }
    return Array.from(byGroup.values()).map(
      ({ group, minTop, maxBottom, count }) => {
        const startMin = Math.round((minTop / HOUR_PX + DAY_START) * 60);
        const endMin = Math.round((maxBottom / HOUR_PX + DAY_START) * 60);
        return {
          groupId: group.id,
          groupName: group.name,
          groupColor: group.color,
          top: minTop - GROUP_HEADER_HEIGHT,
          height: maxBottom - minTop + GROUP_HEADER_HEIGHT + 4,
          itemCount: count,
          timeRange: `${minToHHMM(startMin)} - ${minToHHMM(endMin)}`,
        };
      },
    );
  }, [placedItems, routineGroups]);

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
        style={{
          height: gridHeight,
          paddingLeft: GUTTER_LEFT,
          paddingRight: GRID_RIGHT,
        }}
      >
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
              style={{ left: GUTTER_LEFT, top: HOUR_PX / 2 }}
            />
          </div>
        ))}

        {/* Group frames (behind items) */}
        {groupFrames.map((gf) => (
          <GroupFrame
            key={gf.groupId}
            groupName={gf.groupName}
            groupColor={gf.groupColor}
            top={gf.top}
            height={gf.height}
            itemCount={gf.itemCount}
            timeRange={gf.timeRange}
            headerHeight={GROUP_HEADER_HEIGHT}
          />
        ))}

        {/* Event blocks with column layout */}
        {placedItems.map((p) => {
          const palette = kindPalette(p.item.kind);
          // Column width/left inside the grid's padded area
          const colLeftPct =
            p.totalColumns === 1 ? 0 : (p.column / p.totalColumns) * 100;
          const colWidthPct = p.totalColumns === 1 ? 100 : 100 / p.totalColumns;
          // Use 2px gutters between columns
          const colLeft = `calc(${colLeftPct}% + 2px)`;
          const colWidth = `calc(${colWidthPct}% - 4px)`;
          return (
            <button
              key={p.item.id}
              onClick={() => onEditEvent(p.item)}
              className="absolute flex cursor-pointer flex-col overflow-hidden rounded-lg text-left"
              style={{
                left: colLeft,
                width: colWidth,
                top: p.top,
                height: p.height,
                background: palette.bg,
                borderLeft: `3px solid ${palette.dot}`,
                padding: "4px 6px 4px 7px",
                zIndex: 2,
              }}
            >
              <div className="flex min-w-0 items-center gap-1 text-[11px] font-semibold text-notion-text">
                {p.item.kind === "routine" && (
                  <Repeat size={10} style={{ color: palette.dot }} />
                )}
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {p.item.title}
                </span>
              </div>
              {p.height > 34 && (
                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[9.5px] font-medium text-notion-text-secondary">
                  {p.item.start} – {p.item.end}
                </div>
              )}
            </button>
          );
        })}

        {showNow && (
          <div
            className="pointer-events-none absolute right-0 z-20"
            style={{ left: GUTTER_LEFT - 8, top: nowTopPx, height: 0 }}
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
