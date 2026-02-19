import { useState, useEffect, useCallback } from "react";
import {
  RotateCcw,
  Trash2,
  Folder,
  FileText,
  StickyNote,
  Volume2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { useNoteContext } from "../../hooks/useNoteContext";
import { useAudioContext } from "../../hooks/useAudioContext";
import { getDataService } from "../../services";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { LAYOUT } from "../../constants/layout";
import type { CustomSoundMeta } from "../../types/customSound";
import type { SoundDisplayMeta } from "../../types/sound";

export function TrashView() {
  const { t } = useTranslation();
  const { deletedNodes, restoreNode, permanentDelete } = useTaskTreeContext();
  const { deletedNotes, loadDeletedNotes, restoreNote, permanentDeleteNote } =
    useNoteContext();
  const audio = useAudioContext();

  const [deletedSounds, setDeletedSounds] = useState<CustomSoundMeta[]>([]);
  const [displayMetas, setDisplayMetas] = useState<SoundDisplayMeta[]>([]);

  const loadDeletedSounds = useCallback(async () => {
    const ds = getDataService();
    const [sounds, metas] = await Promise.all([
      ds.fetchDeletedCustomSounds(),
      ds.fetchAllSoundDisplayMeta(),
    ]);
    setDeletedSounds(sounds);
    setDisplayMetas(metas);
  }, []);

  useEffect(() => {
    loadDeletedNotes();
    loadDeletedSounds();
  }, [loadDeletedNotes, loadDeletedSounds]);

  const topLevelDeleted = deletedNodes.filter((n) => {
    if (!n.parentId) return true;
    return !deletedNodes.some((d) => d.id === n.parentId);
  });

  const [deleteTarget, setDeleteTarget] = useState<{
    type: "task" | "note" | "sound";
    id: string;
    name: string;
  } | null>(null);

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

  const isEmpty =
    topLevelDeleted.length === 0 &&
    deletedNotes.length === 0 &&
    deletedSounds.length === 0;

  return (
    <div
      className={`h-full flex flex-col ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
    >
      <h2 className="text-2xl font-bold text-notion-text border-b border-notion-border mb-5 pb-3">
        {t("trash.title")}
      </h2>

      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <p className="text-sm text-notion-text-secondary py-4">
            {t("trash.empty")}
          </p>
        ) : (
          <div className="space-y-6">
            {topLevelDeleted.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-notion-text-secondary uppercase tracking-wide px-1">
                  {t("trash.tasks")}
                </h4>
                {topLevelDeleted.map((node) => {
                  const Icon = node.type === "task" ? FileText : Folder;
                  return (
                    <div
                      key={node.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-notion-hover group"
                    >
                      <Icon
                        size={16}
                        className="text-notion-text-secondary shrink-0"
                      />
                      <span className="flex-1 text-sm text-notion-text truncate">
                        {node.title}
                      </span>
                      <span className="text-xs text-notion-text-secondary">
                        {t(`trash.${node.type}`)}
                      </span>
                      <button
                        onClick={() => restoreNode(node.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-notion-text-secondary hover:text-notion-success transition-opacity"
                        title={t("trash.restore")}
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteTarget({
                            type: "task",
                            id: node.id,
                            name: node.title,
                          })
                        }
                        className="opacity-0 group-hover:opacity-100 p-1 text-notion-text-secondary hover:text-notion-danger transition-opacity"
                        title={t("trash.deletePermanently")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {deletedNotes.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-notion-text-secondary uppercase tracking-wide px-1">
                  {t("trash.notes")}
                </h4>
                {deletedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-notion-hover group"
                  >
                    <StickyNote
                      size={16}
                      className="text-notion-text-secondary shrink-0"
                    />
                    <span className="flex-1 text-sm text-notion-text truncate">
                      {note.title}
                    </span>
                    <span className="text-xs text-notion-text-secondary">
                      {t("trash.note")}
                    </span>
                    <button
                      onClick={() => restoreNote(note.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-notion-text-secondary hover:text-notion-success transition-opacity"
                      title={t("trash.restore")}
                    >
                      <RotateCcw size={14} />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteTarget({
                          type: "note",
                          id: note.id,
                          name: note.title,
                        })
                      }
                      className="opacity-0 group-hover:opacity-100 p-1 text-notion-text-secondary hover:text-notion-danger transition-opacity"
                      title={t("trash.deletePermanently")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {deletedSounds.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-medium text-notion-text-secondary uppercase tracking-wide px-1">
                  {t("trash.sounds")}
                </h4>
                {deletedSounds.map((sound) => (
                  <div
                    key={sound.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-notion-hover group"
                  >
                    <Volume2
                      size={16}
                      className="text-notion-text-secondary shrink-0"
                    />
                    <span className="flex-1 text-sm text-notion-text truncate">
                      {getSoundDisplayName(sound)}
                    </span>
                    <span className="text-xs text-notion-text-secondary">
                      {t("trash.sound")}
                    </span>
                    <button
                      onClick={() => handleRestoreSound(sound.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-notion-text-secondary hover:text-notion-success transition-opacity"
                      title={t("trash.restore")}
                    >
                      <RotateCcw size={14} />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteTarget({
                          type: "sound",
                          id: sound.id,
                          name: getSoundDisplayName(sound),
                        })
                      }
                      className="opacity-0 group-hover:opacity-100 p-1 text-notion-text-secondary hover:text-notion-danger transition-opacity"
                      title={t("trash.deletePermanently")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
            } else {
              handlePermanentDeleteSound(deleteTarget.id);
            }
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
