import { Suspense, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getDataService } from "../../services/dataServiceFactory";
import { useSyncContext } from "../../hooks/useSyncContext";
import type { MemoNode } from "../../types/memo";
import { LazyMemoEditor as MemoEditor } from "../Tasks/TaskDetail/LazyMemoEditor";

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

export function MobileMemoView() {
  const { t } = useTranslation();
  const { syncVersion } = useSyncContext();
  const [memos, setMemos] = useState<MemoNode[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const ds = getDataService();

  const loadMemos = useCallback(async () => {
    try {
      const all = await ds.fetchAllMemos();
      setMemos(all.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (e) {
      console.error("Failed to load memos:", e);
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

  const selectedMemo = selectedDate
    ? (memos.find((m) => m.date === selectedDate) ?? null)
    : null;

  if (selectedDate) {
    return (
      <MobileMemoDetail
        key={selectedDate}
        date={selectedDate}
        memo={selectedMemo}
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
        <h2 className="text-sm font-medium text-notion-text-primary">
          {t("mobile.tabs.memos", "Memos")}
        </h2>
        <button
          onClick={handleNewMemo}
          className="rounded bg-notion-accent px-3 py-1 text-xs text-white"
        >
          + {t("mobile.memo.today", "Today")}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-notion-text-secondary">
            {t("common.loading", "Loading...")}
          </div>
        ) : memos.length === 0 ? (
          <div className="p-8 text-center text-sm text-notion-text-secondary">
            {t("mobile.memo.empty", "No memos yet")}
          </div>
        ) : (
          <ul>
            {memos.map((memo) => (
              <li
                key={memo.date}
                onClick={() => setSelectedDate(memo.date)}
                className="cursor-pointer border-b border-notion-border px-4 py-3 active:bg-notion-hover"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-notion-text-primary">
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
  memo: MemoNode | null;
  onBack: () => void | Promise<void>;
}

function MobileMemoDetail({ date, memo, onBack }: MobileMemoDetailProps) {
  const { t } = useTranslation();
  const ds = getDataService();

  const handleContentChange = useCallback(
    async (content: string) => {
      try {
        await ds.upsertMemo(date, content);
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
        <span className="text-sm font-medium text-notion-text-primary">
          {date}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-notion-bg-primary p-4">
        <Suspense
          fallback={
            <div className="text-sm text-notion-text-secondary">
              {t("common.loading", "Loading...")}
            </div>
          }
        >
          <MemoEditor
            taskId={date}
            initialContent={memo?.content ?? ""}
            onUpdate={handleContentChange}
            entityType="memo"
            syncEntityId={memo?.id}
          />
        </Suspense>
      </div>
    </div>
  );
}
