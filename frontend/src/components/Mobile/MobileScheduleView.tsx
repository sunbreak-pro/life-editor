import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getDataService } from "../../services/dataServiceFactory";
import type { ScheduleItem } from "../../types/schedule";

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDate(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}

export function MobileScheduleView() {
  const { t } = useTranslation();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [loading, setLoading] = useState(true);

  const ds = getDataService();

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ds.fetchScheduleItemsByDate(selectedDate);
      setItems(result.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    } catch (e) {
      console.error("Failed to load schedule:", e);
    } finally {
      setLoading(false);
    }
  }, [ds, selectedDate]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function handleToggle(id: string) {
    try {
      await ds.toggleScheduleItemComplete(id);
      await loadItems();
    } catch (e) {
      console.error("Failed to toggle:", e);
    }
  }

  // Date navigation: -1, today, +1
  const dates = [-1, 0, 1].map((offset) => ({
    date: formatDate(offset),
    label:
      offset === 0
        ? t("mobile.schedule.today", "Today")
        : offset === -1
          ? t("mobile.schedule.yesterday", "Yesterday")
          : t("mobile.schedule.tomorrow", "Tomorrow"),
  }));

  return (
    <div className="flex h-full flex-col">
      {/* Date selector */}
      <div className="flex border-b border-notion-border">
        {dates.map(({ date, label }) => (
          <button
            key={date}
            onClick={() => setSelectedDate(date)}
            className={`flex-1 py-2.5 text-center text-xs transition-colors ${
              selectedDate === date
                ? "border-b-2 border-notion-accent font-medium text-notion-accent"
                : "text-notion-text-secondary"
            }`}
          >
            <div>{label}</div>
            <div className="mt-0.5 text-[10px] opacity-60">{date}</div>
          </button>
        ))}
      </div>

      {/* Schedule items */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-notion-text-secondary">
            {t("common.loading", "Loading...")}
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-notion-text-secondary">
            {t("mobile.schedule.empty", "No schedule items")}
          </div>
        ) : (
          <ul>
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 border-b border-notion-border px-4 py-3"
              >
                <button
                  onClick={() => handleToggle(item.id)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    item.completed
                      ? "border-notion-accent bg-notion-accent text-white"
                      : "border-notion-border"
                  }`}
                >
                  {item.completed && <span className="text-xs">✓</span>}
                </button>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm ${
                      item.completed
                        ? "text-notion-text-secondary line-through"
                        : "text-notion-text-primary"
                    }`}
                  >
                    {item.title}
                  </div>
                  <div className="text-xs text-notion-text-secondary">
                    {item.startTime} - {item.endTime}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
