import { useMemo } from "react";
import {
  FileText,
  FolderOpen,
  Pin,
  PlusCircle,
  BookOpen,
  CalendarDays,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNoteContext } from "../../hooks/useNoteContext";
import { useMemoContext } from "../../hooks/useMemoContext";
import { useAnalyticsFilter } from "../../context/AnalyticsFilterContext";
import { formatDateKey } from "../../utils/dateKey";
import { AnalyticsStatCard } from "./AnalyticsStatCard";
import { NoteCreationTrend } from "./NoteCreationTrend";
import { MemoActivityHeatmap } from "./MemoActivityHeatmap";
import { NotesByFolderChart } from "./NotesByFolderChart";

export function MaterialsTab() {
  const { t } = useTranslation();
  const { notes } = useNoteContext();
  const { memos } = useMemoContext();
  const { dateRange, visibleCharts } = useAnalyticsFilter();

  const stats = useMemo(() => {
    const activeNotes = notes.filter((n) => !n.isDeleted);
    const noteItems = activeNotes.filter((n) => n.type === "note");
    const noteFolders = activeNotes.filter((n) => n.type === "folder");
    const pinnedNotes = noteItems.filter((n) => n.isPinned);

    const startStr = formatDateKey(dateRange.start);
    const endStr = formatDateKey(dateRange.end);

    const createdInPeriod = noteItems.filter((n) => {
      const d = n.createdAt.substring(0, 10);
      return d >= startStr && d <= endStr;
    });

    const activeMemos = memos.filter((m) => !m.isDeleted);
    const memosInPeriod = activeMemos.filter((m) => {
      return m.date >= startStr && m.date <= endStr;
    });

    return {
      totalNotes: noteItems.length,
      noteFolders: noteFolders.length,
      pinnedNotes: pinnedNotes.length,
      createdInPeriod: createdInPeriod.length,
      totalMemos: activeMemos.length,
      memosInPeriod: memosInPeriod.length,
    };
  }, [notes, memos, dateRange]);

  const days = Math.max(
    1,
    Math.ceil(
      (dateRange.end.getTime() - dateRange.start.getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );

  const activeNotes = useMemo(() => notes.filter((n) => !n.isDeleted), [notes]);

  if (stats.totalNotes === 0 && stats.totalMemos === 0) {
    return (
      <div className="max-w-3xl mx-auto w-full">
        <p className="text-sm text-notion-text-secondary mt-4 text-center">
          {t("analytics.materials.noNotes")}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <AnalyticsStatCard
          icon={<FileText size={20} />}
          label={t("analytics.materials.totalNotes")}
          value={stats.totalNotes}
          color="text-purple-500"
        />
        <AnalyticsStatCard
          icon={<FolderOpen size={20} />}
          label={t("analytics.materials.noteFolders")}
          value={stats.noteFolders}
          color="text-notion-text-secondary"
        />
        <AnalyticsStatCard
          icon={<Pin size={20} />}
          label={t("analytics.materials.pinnedNotes")}
          value={stats.pinnedNotes}
          color="text-yellow-500"
        />
        <AnalyticsStatCard
          icon={<PlusCircle size={20} />}
          label={t("analytics.materials.createdPeriod")}
          value={stats.createdInPeriod}
          color="text-notion-success"
        />
        <AnalyticsStatCard
          icon={<BookOpen size={20} />}
          label={t("analytics.materials.totalMemos")}
          value={stats.totalMemos}
          color="text-blue-500"
        />
        <AnalyticsStatCard
          icon={<CalendarDays size={20} />}
          label={t("analytics.materials.memosPeriod")}
          value={stats.memosInPeriod}
          color="text-orange-500"
        />
      </div>

      {visibleCharts.has("noteCreationTrend") && (
        <NoteCreationTrend notes={activeNotes} days={days} />
      )}

      {visibleCharts.has("memoActivityHeatmap") && (
        <MemoActivityHeatmap memos={memos} />
      )}

      {visibleCharts.has("notesByFolder") && (
        <NotesByFolderChart notes={activeNotes} />
      )}
    </div>
  );
}
