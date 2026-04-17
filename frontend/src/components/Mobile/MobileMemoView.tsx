import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getDataService } from "../../services/dataServiceFactory";
import { useSyncContext } from "../../hooks/useSyncContext";
import type { MemoNode } from "../../types/memo";

export function MobileMemoView() {
  const { t } = useTranslation();
  const { syncVersion } = useSyncContext();
  const [memos, setMemos] = useState<MemoNode[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
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

  useEffect(() => {
    if (selectedDate) {
      const memo = memos.find((m) => m.date === selectedDate);
      setEditContent(memo?.content || "");
    }
  }, [selectedDate, memos]);

  async function handleSave() {
    if (!selectedDate) return;
    try {
      await ds.upsertMemo(selectedDate, editContent);
      await loadMemos();
    } catch (e) {
      console.error("Failed to save memo:", e);
    }
  }

  function handleNewMemo() {
    const today = new Date().toISOString().split("T")[0];
    setSelectedDate(today);
    if (!memos.find((m) => m.date === today)) {
      setEditContent("");
    }
  }

  if (selectedDate) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-notion-border px-4 py-3">
          <button
            onClick={() => setSelectedDate(null)}
            className="text-sm text-notion-accent"
          >
            &larr; {t("common.back", "Back")}
          </button>
          <span className="text-sm font-medium text-notion-text-primary">
            {selectedDate}
          </span>
          <button
            onClick={handleSave}
            className="ml-auto rounded bg-notion-accent px-3 py-1 text-xs text-white"
          >
            {t("common.save", "Save")}
          </button>
        </div>
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="min-h-0 flex-1 resize-none bg-notion-bg-primary p-4 text-sm text-notion-text-primary focus:outline-none"
          placeholder={t("mobile.memo.placeholder", "Write your thoughts...")}
          autoFocus
        />
      </div>
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
