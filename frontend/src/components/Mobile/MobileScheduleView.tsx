import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Repeat, Clock, Trash2 } from "lucide-react";
import { getDataService } from "../../services/dataServiceFactory";
import type { ScheduleItem } from "../../types/schedule";
import { MobileCalendarStrip } from "./MobileCalendarStrip";
import {
  MobileScheduleItemForm,
  type ScheduleItemFormData,
} from "./MobileScheduleItemForm";

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function generateId(): string {
  return `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// --- Swipeable item for delete ---

const SWIPE_DELETE_THRESHOLD = 80;

interface SwipeableItemProps {
  children: React.ReactNode;
  onDelete: () => void;
}

function SwipeableItem({ children, onDelete }: SwipeableItemProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const touchRef = useRef<{
    startX: number;
    startY: number;
    locked: boolean | null;
  }>({ startX: 0, startY: 0, locked: null });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      locked: null,
    };
    setIsTransitioning(false);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = touch.clientY - touchRef.current.startY;

    if (touchRef.current.locked === null) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        touchRef.current.locked = Math.abs(deltaX) > Math.abs(deltaY);
      }
      return;
    }

    if (!touchRef.current.locked) return;

    // Only allow swiping left
    const clampedX = Math.min(0, Math.max(-120, deltaX));
    setOffsetX(clampedX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchRef.current.locked !== true) return;

    setIsTransitioning(true);
    if (Math.abs(offsetX) > SWIPE_DELETE_THRESHOLD) {
      setOffsetX(-120);
    } else {
      setOffsetX(0);
    }
    touchRef.current.locked = null;
  }, [offsetX]);

  const resetSwipe = useCallback(() => {
    setIsTransitioning(true);
    setOffsetX(0);
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* Delete button behind */}
      <div className="absolute inset-y-0 right-0 flex w-[120px] items-center justify-center bg-notion-danger">
        <button
          onClick={() => {
            onDelete();
            resetSwipe();
          }}
          className="flex flex-col items-center gap-1 text-white"
        >
          <Trash2 size={18} />
          <span className="text-xs">Delete</span>
        </button>
      </div>

      {/* Foreground content */}
      <div
        className="relative bg-notion-bg"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isTransitioning ? "transform 200ms ease-out" : "none",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (Math.abs(offsetX) > 10) {
            resetSwipe();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

// --- Main view ---

export function MobileScheduleView() {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [weekItems, setWeekItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  const ds = getDataService();

  // Load items for the selected date
  const loadItems = useCallback(
    async (date: string) => {
      setLoading(true);
      try {
        const result = await ds.fetchScheduleItemsByDate(date);
        setItems(result.sort((a, b) => a.startTime.localeCompare(b.startTime)));
      } catch (e) {
        console.error("Failed to load schedule:", e);
      } finally {
        setLoading(false);
      }
    },
    [ds],
  );

  // Load item counts for the week (for dots on calendar strip)
  const loadWeekItems = useCallback(
    async (date: string) => {
      try {
        // Get the Monday of the week containing the selected date
        const d = new Date(date + "T00:00:00");
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const monday = new Date(d);
        monday.setDate(d.getDate() + diff);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const fmt = (dt: Date) => {
          const y = dt.getFullYear();
          const m = String(dt.getMonth() + 1).padStart(2, "0");
          const dd = String(dt.getDate()).padStart(2, "0");
          return `${y}-${m}-${dd}`;
        };

        const result = await ds.fetchScheduleItemsByDateRange(
          fmt(monday),
          fmt(sunday),
        );
        setWeekItems(result);
      } catch (e) {
        console.error("Failed to load week items:", e);
      }
    },
    [ds],
  );

  useEffect(() => {
    loadItems(selectedDate);
    loadWeekItems(selectedDate);
  }, [selectedDate, loadItems, loadWeekItems]);

  // Item count by date for calendar dots
  const itemCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of weekItems) {
      map.set(item.date, (map.get(item.date) ?? 0) + 1);
    }
    return map;
  }, [weekItems]);

  // Handlers
  const handleDateSelect = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const handleToggle = useCallback(
    async (id: string) => {
      try {
        await ds.toggleScheduleItemComplete(id);
        await loadItems(selectedDate);
        await loadWeekItems(selectedDate);
      } catch (e) {
        console.error("Failed to toggle:", e);
      }
    },
    [ds, selectedDate, loadItems, loadWeekItems],
  );

  const handleCreate = useCallback(() => {
    setEditingItem(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((item: ScheduleItem) => {
    setEditingItem(item);
    setFormOpen(true);
  }, []);

  const handleSave = useCallback(
    async (data: ScheduleItemFormData) => {
      try {
        if (editingItem) {
          await ds.updateScheduleItem(editingItem.id, {
            title: data.title,
            startTime: data.startTime,
            endTime: data.endTime,
            memo: data.memo || null,
            isAllDay: data.isAllDay,
          });
        } else {
          await ds.createScheduleItem(
            generateId(),
            data.date,
            data.title,
            data.isAllDay ? "00:00" : data.startTime,
            data.isAllDay ? "23:59" : data.endTime,
            undefined,
            undefined,
            undefined,
            data.isAllDay,
          );
        }
        setFormOpen(false);
        setEditingItem(null);
        await loadItems(selectedDate);
        await loadWeekItems(selectedDate);
      } catch (e) {
        console.error("Failed to save schedule item:", e);
      }
    },
    [ds, editingItem, selectedDate, loadItems, loadWeekItems],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await ds.deleteScheduleItem(id);
        setFormOpen(false);
        setEditingItem(null);
        await loadItems(selectedDate);
        await loadWeekItems(selectedDate);
      } catch (e) {
        console.error("Failed to delete schedule item:", e);
      }
    },
    [ds, selectedDate, loadItems, loadWeekItems],
  );

  // Group items: all-day first, then by time
  const allDayItems = items.filter((i) => i.isAllDay);
  const timedItems = items.filter((i) => !i.isAllDay);

  const formattedDate = useMemo(() => {
    const d = new Date(selectedDate + "T00:00:00");
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [selectedDate]);

  return (
    <div className="flex h-full flex-col">
      {/* Calendar strip */}
      <MobileCalendarStrip
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
        itemCountByDate={itemCountByDate}
      />

      {/* Day header */}
      <div className="flex items-center justify-between border-b border-notion-border px-4 py-2.5">
        <span className="text-sm font-medium text-notion-text">
          {formattedDate}
        </span>
        <span className="text-xs text-notion-text-secondary">
          {items.length > 0
            ? t("mobile.schedule.itemCount", "{{count}} items", {
                count: items.length,
              })
            : ""}
        </span>
      </div>

      {/* Schedule items list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-sm text-notion-text-secondary">
            {t("common.loading", "Loading...")}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12">
            <Clock size={32} className="text-notion-text-secondary/40" />
            <p className="text-sm text-notion-text-secondary">
              {t("mobile.schedule.empty", "No schedule items")}
            </p>
            <button
              onClick={handleCreate}
              className="mt-2 rounded-lg bg-notion-accent px-4 py-2 text-sm font-medium text-white active:opacity-80"
            >
              {t("mobile.schedule.addFirst", "Add item")}
            </button>
          </div>
        ) : (
          <div>
            {/* All-day items */}
            {allDayItems.length > 0 && (
              <div className="border-b border-notion-border px-4 py-2">
                <span className="text-xs font-medium text-notion-text-secondary">
                  {t("mobile.schedule.allDay", "All day")}
                </span>
                {allDayItems.map((item) => (
                  <SwipeableItem
                    key={item.id}
                    onDelete={() => handleDelete(item.id)}
                  >
                    <ScheduleItemRow
                      item={item}
                      onToggle={handleToggle}
                      onEdit={handleEdit}
                      showTime={false}
                    />
                  </SwipeableItem>
                ))}
              </div>
            )}

            {/* Timed items */}
            {timedItems.map((item) => (
              <SwipeableItem
                key={item.id}
                onDelete={() => handleDelete(item.id)}
              >
                <ScheduleItemRow
                  item={item}
                  onToggle={handleToggle}
                  onEdit={handleEdit}
                  showTime
                />
              </SwipeableItem>
            ))}
          </div>
        )}
      </div>

      {/* FAB - Create button */}
      {items.length > 0 && (
        <button
          onClick={handleCreate}
          className="absolute right-4 bottom-20 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-notion-accent shadow-lg active:opacity-80"
          aria-label={t("mobile.schedule.create", "New Item")}
        >
          <Plus size={24} className="text-white" />
        </button>
      )}

      {/* Create/Edit form */}
      <MobileScheduleItemForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSave}
        onDelete={editingItem ? () => handleDelete(editingItem.id) : undefined}
        editingItem={editingItem}
        defaultDate={selectedDate}
      />
    </div>
  );
}

// --- Schedule item row ---

interface ScheduleItemRowProps {
  item: ScheduleItem;
  onToggle: (id: string) => void;
  onEdit: (item: ScheduleItem) => void;
  showTime: boolean;
}

function ScheduleItemRow({
  item,
  onToggle,
  onEdit,
  showTime,
}: ScheduleItemRowProps) {
  const isRoutine = !!item.routineId;
  const isDone = item.completed;

  return (
    <div
      className="flex items-center gap-3 border-b border-notion-border px-4 py-3 active:bg-notion-hover"
      onClick={() => onEdit(item)}
    >
      {/* Completion toggle - 44px touch target */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(item.id);
        }}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
          isDone
            ? "border-notion-accent bg-notion-accent"
            : isRoutine
              ? "border-notion-success"
              : "border-notion-border"
        }`}
        style={{ minWidth: 28, minHeight: 28 }}
      >
        {isDone && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="text-white"
          >
            <path
              d="M3 7L6 10L11 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {isRoutine && (
            <Repeat size={12} className="shrink-0 text-notion-success" />
          )}
          <span
            className={`truncate text-sm ${
              isDone
                ? "text-notion-text-secondary line-through"
                : "text-notion-text"
            }`}
          >
            {item.title}
          </span>
        </div>
        {showTime && (
          <span className="mt-0.5 block text-xs text-notion-text-secondary">
            {item.startTime} - {item.endTime}
          </span>
        )}
        {item.memo && (
          <span className="mt-0.5 block truncate text-xs text-notion-text-secondary/70">
            {item.memo}
          </span>
        )}
      </div>
    </div>
  );
}
