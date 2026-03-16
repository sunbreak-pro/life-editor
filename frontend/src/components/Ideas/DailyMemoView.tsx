import { Suspense, useCallback } from "react";
import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMemoContext } from "../../hooks/useMemoContext";
import { formatDateTime } from "../../utils/formatRelativeDate";
import { formatDateHeading } from "../../utils/dateKey";
import { LazyMemoEditor as MemoEditor } from "../Tasks/TaskDetail/LazyMemoEditor";
import { WikiTagList } from "../WikiTags/WikiTagList";

export function DailyMemoView() {
  const { selectedDate, selectedMemo, upsertMemo, togglePin } =
    useMemoContext();
  const { t } = useTranslation();

  const handleUpdate = useCallback(
    (content: string) => {
      upsertMemo(selectedDate, content);
    },
    [selectedDate, upsertMemo],
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-6">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold text-notion-text flex-1">
            {formatDateHeading(selectedDate)}
          </h2>
          {selectedMemo && (
            <button
              onClick={() => togglePin(selectedDate)}
              className={`p-1.5 rounded transition-colors ${
                selectedMemo.isPinned
                  ? "text-red-500 hover:text-red-400"
                  : "text-notion-text-secondary hover:text-notion-text"
              }`}
              title={
                selectedMemo.isPinned
                  ? t("notesView.unfavorite")
                  : t("notesView.favorite")
              }
            >
              {selectedMemo.isPinned ? (
                <Heart size={16} className="fill-current" />
              ) : (
                <Heart size={16} />
              )}
            </button>
          )}
        </div>
        {selectedMemo?.updatedAt && (
          <p className="text-[11px] text-notion-text-secondary/60 mb-4">
            {t("dateTime.updated")}: {formatDateTime(selectedMemo.updatedAt)}
          </p>
        )}
        {!selectedMemo?.updatedAt && <div className="mb-4" />}
        {selectedMemo && (
          <div className="mb-3">
            <WikiTagList entityId={selectedMemo.id} entityType="memo" />
          </div>
        )}
        <Suspense
          fallback={
            <div className="text-notion-text-secondary text-sm">
              {t("dateTime.loadingEditor")}
            </div>
          }
        >
          <MemoEditor
            taskId={selectedDate}
            initialContent={selectedMemo?.content}
            onUpdate={handleUpdate}
            entityType="memo"
          />
        </Suspense>
      </div>
    </div>
  );
}
