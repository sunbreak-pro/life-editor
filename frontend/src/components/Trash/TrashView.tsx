import { useState, useEffect } from "react";
import {
  RotateCcw,
  Trash2,
  Folder,
  FileText,
  StickyNote,
  Volume2,
  Calendar,
  CalendarDays,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { useNoteContext } from "../../hooks/useNoteContext";
import { useAudioContext } from "../../hooks/useAudioContext";
import { useDailyContext } from "../../hooks/useDailyContext";
import { useRoutineContext } from "../../hooks/useRoutineContext";
import { useScheduleItemsContext } from "../../hooks/useScheduleItemsContext";
import { getDataService } from "../../services";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import type { CustomSoundMeta } from "../../types/customSound";
import type { SoundDisplayMeta } from "../../types/sound";

export type TrashSub = "tasks" | "routine" | "events" | "materials" | "sounds";

interface TrashViewProps {
  activeTab: TrashSub;
  searchQuery: string;
}

export function TrashView({ activeTab, searchQuery }: TrashViewProps) {
  const { t } = useTranslation();
  const { deletedNodes, restoreNode, permanentDelete } = useTaskTreeContext();
  const { deletedNotes, loadDeletedNotes, restoreNote, permanentDeleteNote } =
    useNoteContext();
  const {
    deletedDailies,
    loadDeletedDailies,
    restoreDaily,
    permanentDeleteDaily,
  } = useDailyContext();
  const {
    deletedRoutines,
    loadDeletedRoutines,
    restoreRoutine,
    permanentDeleteRoutine,
  } = useRoutineContext();
  const {
    deletedScheduleItems,
    loadDeletedScheduleItems,
    restoreScheduleItem,
    permanentDeleteScheduleItem,
  } = useScheduleItemsContext();
  const audio = useAudioContext();

  const [deletedSounds, setDeletedSounds] = useState<CustomSoundMeta[]>([]);
  const [displayMetas, setDisplayMetas] = useState<SoundDisplayMeta[]>([]);

  useEffect(() => {
    loadDeletedNotes();
    loadDeletedDailies();
    loadDeletedRoutines();
    loadDeletedScheduleItems();
  }, [
    loadDeletedNotes,
    loadDeletedDailies,
    loadDeletedRoutines,
    loadDeletedScheduleItems,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ds = getDataService();
      const [sounds, metas] = await Promise.all([
        ds.fetchDeletedCustomSounds(),
        ds.fetchAllSoundDisplayMeta(),
      ]);
      if (!cancelled) {
        setDeletedSounds(sounds);
        setDisplayMetas(metas);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const topLevelDeleted = deletedNodes.filter((n) => {
    if (!n.parentId) return true;
    return !deletedNodes.some((d) => d.id === n.parentId);
  });

  const query = searchQuery.toLowerCase();
  const matchesSearch = (text: string) =>
    !query || text.toLowerCase().includes(query);

  const deletedFolders = topLevelDeleted.filter(
    (n) => n.type === "folder" && matchesSearch(n.title),
  );
  const deletedTasks = topLevelDeleted.filter(
    (n) => n.type === "task" && matchesSearch(n.title),
  );

  const [deleteTarget, setDeleteTarget] = useState<{
    type: "task" | "note" | "sound" | "routine" | "memo" | "scheduleItem";
    id: string;
    name: string;
  } | null>(null);

  const [emptyTarget, setEmptyTarget] = useState<TrashSub | null>(null);
  const [emptying, setEmptying] = useState(false);

  const getSoundDisplayName = (sound: CustomSoundMeta): string => {
    const meta = displayMetas.find((m) => m.soundId === sound.id);
    return meta?.displayName || sound.label;
  };

  const handleRestoreSound = async (id: string) => {
    await getDataService().restoreCustomSound(id);
    setDeletedSounds((prev) => prev.filter((s) => s.id !== id));
    await audio.reloadCustomSounds();
  };

  const handlePermanentDeleteSound = async (id: string) => {
    await getDataService().permanentDeleteCustomSound(id);
    setDeletedSounds((prev) => prev.filter((s) => s.id !== id));
  };

  const categoryLabel = (cat: TrashSub): string => {
    switch (cat) {
      case "tasks":
        return t("trash.tabTasks");
      case "routine":
        return t("trash.tabRoutine");
      case "events":
        return t("trash.tabEvents");
      case "materials":
        return t("trash.tabMaterials");
      case "sounds":
        return t("trash.tabSounds");
    }
  };

  const categoryCount = (cat: TrashSub): number => {
    switch (cat) {
      case "tasks":
        return deletedNodes.length;
      case "routine":
        return deletedRoutines.length;
      case "events":
        return deletedScheduleItems.length;
      case "materials":
        return deletedDailies.length + deletedNotes.length;
      case "sounds":
        return deletedSounds.length;
    }
  };

  // Permanently delete every trashed item of the given category (ignores the
  // search filter — "empty trash" clears the whole category, not just the
  // visible subset). Irreversible; gated by a ConfirmDialog.
  const handleEmptyCategory = async (cat: TrashSub) => {
    setEmptying(true);
    try {
      if (cat === "tasks") {
        for (const n of topLevelDeleted)
          await Promise.resolve(permanentDelete(n.id));
      } else if (cat === "routine") {
        for (const r of deletedRoutines)
          await Promise.resolve(permanentDeleteRoutine(r.id));
      } else if (cat === "events") {
        for (const e of deletedScheduleItems)
          await Promise.resolve(permanentDeleteScheduleItem(e.id));
      } else if (cat === "materials") {
        for (const d of deletedDailies)
          await Promise.resolve(permanentDeleteDaily(d.date));
        for (const note of deletedNotes)
          await Promise.resolve(permanentDeleteNote(note.id));
      } else {
        for (const s of [...deletedSounds])
          await handlePermanentDeleteSound(s.id);
      }
    } finally {
      setEmptying(false);
      setEmptyTarget(null);
    }
  };

  const renderEmptyHeader = (cat: TrashSub) => {
    const count = categoryCount(cat);
    return (
      <div className="flex justify-end mb-3">
        <button
          type="button"
          disabled={count === 0 || emptying}
          onClick={() => setEmptyTarget(cat)}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md text-white bg-notion-danger/80 hover:bg-notion-danger disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 size={13} aria-hidden="true" />
          {emptying
            ? t("trash.emptying")
            : t("trash.emptyCategory", { category: categoryLabel(cat) })}
        </button>
      </div>
    );
  };

  const renderItem = (
    key: string,
    icon: typeof FileText,
    title: string,
    typeLabel: string,
    onRestore: () => void,
    onDelete: () => void,
  ) => {
    const Icon = icon;
    return (
      <div
        key={key}
        className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-notion-hover group"
      >
        <Icon size={16} className="text-notion-text-secondary shrink-0" />
        <span className="flex-1 text-sm text-notion-text truncate">
          {title}
        </span>
        <span className="text-xs text-notion-text-secondary">{typeLabel}</span>
        <button
          onClick={onRestore}
          className="opacity-0 group-hover:opacity-100 p-1 text-notion-text-secondary hover:text-notion-success transition-opacity"
          title={t("trash.restore")}
        >
          <RotateCcw size={14} />
        </button>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 p-1 text-notion-text-secondary hover:text-notion-danger transition-opacity"
          title={t("trash.deletePermanently")}
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  };

  const renderTasksTab = () => {
    const isEmpty = deletedFolders.length === 0 && deletedTasks.length === 0;
    if (isEmpty)
      return (
        <p className="text-sm text-notion-text-secondary py-4">
          {t("trash.empty")}
        </p>
      );

    return (
      <div className="space-y-6">
        {deletedFolders.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-medium text-notion-text-secondary uppercase tracking-wide px-1">
              {t("trash.folders")}
            </h4>
            {deletedFolders.map((node) =>
              renderItem(
                node.id,
                Folder,
                node.title,
                t("trash.task"),
                () => restoreNode(node.id),
                () =>
                  setDeleteTarget({
                    type: "task",
                    id: node.id,
                    name: node.title,
                  }),
              ),
            )}
          </div>
        )}

        {deletedTasks.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-medium text-notion-text-secondary uppercase tracking-wide px-1">
              {t("trash.tasks")}
            </h4>
            {deletedTasks.map((node) =>
              renderItem(
                node.id,
                FileText,
                node.title,
                t("trash.task"),
                () => restoreNode(node.id),
                () =>
                  setDeleteTarget({
                    type: "task",
                    id: node.id,
                    name: node.title,
                  }),
              ),
            )}
          </div>
        )}
      </div>
    );
  };

  const renderRoutineTab = () => {
    const filtered = deletedRoutines.filter((r) => matchesSearch(r.title));
    if (filtered.length === 0)
      return (
        <p className="text-sm text-notion-text-secondary py-4">
          {t("trash.empty")}
        </p>
      );

    return (
      <div className="space-y-1">
        {filtered.map((routine) =>
          renderItem(
            routine.id,
            Calendar,
            routine.title,
            t("trash.routine"),
            () => restoreRoutine(routine.id),
            () =>
              setDeleteTarget({
                type: "routine",
                id: routine.id,
                name: routine.title,
              }),
          ),
        )}
      </div>
    );
  };

  const renderEventsTab = () => {
    const filtered = deletedScheduleItems.filter((item) =>
      matchesSearch(item.title),
    );
    if (filtered.length === 0)
      return (
        <p className="text-sm text-notion-text-secondary py-4">
          {t("trash.empty")}
        </p>
      );

    return (
      <div className="space-y-1">
        {filtered.map((item) =>
          renderItem(
            item.id,
            CalendarDays,
            item.title,
            `${item.date} ${t("trash.event")}`,
            () => restoreScheduleItem(item.id),
            () =>
              setDeleteTarget({
                type: "scheduleItem",
                id: item.id,
                name: item.title,
              }),
          ),
        )}
      </div>
    );
  };

  const renderMaterialsTab = () => {
    const filteredMemos = deletedDailies.filter((m) => matchesSearch(m.date));
    const filteredNotes = deletedNotes.filter((n) => matchesSearch(n.title));
    const isEmpty = filteredMemos.length === 0 && filteredNotes.length === 0;
    if (isEmpty)
      return (
        <p className="text-sm text-notion-text-secondary py-4">
          {t("trash.empty")}
        </p>
      );

    return (
      <div className="space-y-6">
        {filteredMemos.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-medium text-notion-text-secondary uppercase tracking-wide px-1">
              {t("trash.daily")}
            </h4>
            {filteredMemos.map((memo) =>
              renderItem(
                memo.id,
                FileText,
                memo.date,
                t("trash.memo"),
                () => restoreDaily(memo.date),
                () =>
                  setDeleteTarget({
                    type: "memo",
                    id: memo.date,
                    name: memo.date,
                  }),
              ),
            )}
          </div>
        )}

        {filteredNotes.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-medium text-notion-text-secondary uppercase tracking-wide px-1">
              {t("trash.notes")}
            </h4>
            {filteredNotes.map((note) =>
              renderItem(
                note.id,
                StickyNote,
                note.title,
                t("trash.note"),
                () => restoreNote(note.id),
                () =>
                  setDeleteTarget({
                    type: "note",
                    id: note.id,
                    name: note.title,
                  }),
              ),
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSoundsTab = () => {
    const filtered = deletedSounds.filter((s) =>
      matchesSearch(getSoundDisplayName(s)),
    );
    if (filtered.length === 0)
      return (
        <p className="text-sm text-notion-text-secondary py-4">
          {t("trash.empty")}
        </p>
      );

    return (
      <div className="space-y-1">
        {filtered.map((sound) =>
          renderItem(
            sound.id,
            Volume2,
            getSoundDisplayName(sound),
            t("trash.sound"),
            () => handleRestoreSound(sound.id),
            () =>
              setDeleteTarget({
                type: "sound",
                id: sound.id,
                name: getSoundDisplayName(sound),
              }),
          ),
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col" data-section-id="trash">
      <div className="flex-1 overflow-y-auto">
        {renderEmptyHeader(activeTab)}
        {activeTab === "tasks" && renderTasksTab()}
        {activeTab === "routine" && renderRoutineTab()}
        {activeTab === "events" && renderEventsTab()}
        {activeTab === "materials" && renderMaterialsTab()}
        {activeTab === "sounds" && renderSoundsTab()}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          message={t("trash.permanentDeleteConfirm", {
            name: deleteTarget.name,
          })}
          onConfirm={() => {
            if (deleteTarget.type === "task") {
              permanentDelete(deleteTarget.id);
            } else if (deleteTarget.type === "note") {
              permanentDeleteNote(deleteTarget.id);
            } else if (deleteTarget.type === "routine") {
              permanentDeleteRoutine(deleteTarget.id);
            } else if (deleteTarget.type === "memo") {
              permanentDeleteDaily(deleteTarget.id);
            } else if (deleteTarget.type === "scheduleItem") {
              permanentDeleteScheduleItem(deleteTarget.id);
            } else {
              handlePermanentDeleteSound(deleteTarget.id);
            }
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {emptyTarget && (
        <ConfirmDialog
          message={t("trash.emptyCategoryConfirm", {
            category: categoryLabel(emptyTarget),
            count: categoryCount(emptyTarget),
          })}
          onConfirm={() => handleEmptyCategory(emptyTarget)}
          onCancel={() => setEmptyTarget(null)}
        />
      )}
    </div>
  );
}
