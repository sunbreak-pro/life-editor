import { Suspense, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getDataService } from "../../services/dataServiceFactory";
import { useSyncContext } from "../../hooks/useSyncContext";
import type { DailyNode } from "../../types/daily";
import { LazyRichTextEditor as RichTextEditor } from "../shared/LazyRichTextEditor";

function extractPlainText(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (parsed?.content) {
      return parsed.content
        .map(
          (block: { content?: Array<{ text?: string }> }) =>
            block.content?.map((c) => c.text || "").join("") || "",
        )
        .join(" ")
        .slice(0, 120);
    }
  } catch {
    // plain text
  }
  return content?.slice(0, 120) || "";
}

export function MobileDailyView() {
  const { t } = useTranslation();
  const { syncVersion } = useSyncContext();
  const [dailies, setMemos] = useState<DailyNode[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const ds = getDataService();

  const loadMemos = useCallback(async () => {
    try {
      const all = await ds.fetchAllDailies();
      setMemos(all.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (e) {
      console.error("Failed to load dailies:", e);
    } finally {
      setLoading(false);
    }
  }, [ds]);

  useEffect(() => {
    loadMemos();
  }, [loadMemos, syncVersion]);

  function handleNewMemo() {
    const today = new Date().toISOString().split("T")[0];
    setSelectedDate(today);
  }

  const selectedDaily = selectedDate
    ? (dailies.find((m) => m.date === selectedDate) ?? null)
    : null;

  if (selectedDate) {
    return (
      <MobileMemoDetail
        key={selectedDate}
        date={selectedDate}
        memo={selectedDaily}
        onBack={async () => {
          setSelectedDate(null);
          await loadMemos();
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-notion-border px-4 py-3">
        <h2 className="text-sm font-medium text-notion-text">
          {t("mobile.tabs.daily", "Daily")}
        </h2>
        <button
          onClick={handleNewMemo}
          className="rounded bg-notion-accent px-3 py-1 text-xs text-white"
        >
          + {t("mobile.daily.today", "Today")}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-notion-text-secondary">
            {t("common.loading", "Loading...")}
          </div>
        ) : dailies.length === 0 ? (
          <div className="p-8 text-center text-sm text-notion-text-secondary">
            {t("mobile.daily.empty", "No entries yet")}
          </div>
        ) : (
          <ul>
            {dailies.map((memo) => (
              <li
                key={memo.date}
                onClick={() => setSelectedDate(memo.date)}
                className="cursor-pointer border-b border-notion-border px-4 py-3 active:bg-notion-hover"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-notion-text">
                    {memo.date}
                  </span>
                  {memo.isPinned && (
                    <span className="text-xs text-notion-accent">Pinned</span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-notion-text-secondary">
                  {extractPlainText(memo.content)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface MobileMemoDetailProps {
  date: string;
  memo: DailyNode | null;
  onBack: () => void | Promise<void>;
}

function MobileMemoDetail({ date, memo, onBack }: MobileMemoDetailProps) {
  const { t } = useTranslation();
  const ds = getDataService();

  const handleContentChange = useCallback(
    async (content: string) => {
      try {
        await ds.upsertDaily(date, content);
      } catch (e) {
        console.error("Failed to save memo:", e);
      }
    },
    [date, ds],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-notion-border px-4 py-3">
        <button onClick={onBack} className="text-sm text-notion-accent">
          &larr; {t("common.back", "Back")}
        </button>
        <span className="text-sm font-medium text-notion-text">
          {date}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-notion-bg p-4">
        <Suspense
          fallback={
            <div className="text-sm text-notion-text-secondary">
              {t("common.loading", "Loading...")}
            </div>
          }
        >
          <RichTextEditor
            taskId={date}
            initialContent={memo?.content ?? ""}
            onUpdate={handleContentChange}
            entityType="daily"
            syncEntityId={memo?.id}
          />
        </Suspense>
      </div>
    </div>
  );
}
