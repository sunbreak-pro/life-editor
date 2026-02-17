import { useState, useEffect } from "react";
import { RotateCcw, Trash2, Folder, FileText, StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { useNoteContext } from "../../hooks/useNoteContext";
import { ConfirmDialog } from "../common/ConfirmDialog";

export function TrashBin() {
  const { t } = useTranslation();
  const { deletedNodes, restoreNode, permanentDelete } = useTaskTreeContext();
  const { deletedNotes, loadDeletedNotes, restoreNote, permanentDeleteNote } =
    useNoteContext();

  useEffect(() => {
    loadDeletedNotes();
  }, [loadDeletedNotes]);

  const topLevelDeleted = deletedNodes.filter((n) => {
    if (!n.parentId) return true;
    return !deletedNodes.some((d) => d.id === n.parentId);
  });

  const [deleteTarget, setDeleteTarget] = useState<{
    type: "task" | "note";
    id: string;
    name: string;
  } | null>(null);

  const isEmpty = topLevelDeleted.length === 0 && deletedNotes.length === 0;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-notion-text">
        {t("trash.title")}
      </h3>

      {isEmpty ? (
        <p className="text-sm text-notion-text-secondary py-4">
          {t("trash.empty")}
        </p>
      ) : (
        <div className="space-y-4">
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
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={t("trash.permanentDeleteConfirm", {
            name: deleteTarget.name,
          })}
          onConfirm={() => {
            if (deleteTarget.type === "task") {
              permanentDelete(deleteTarget.id);
            } else {
              permanentDeleteNote(deleteTarget.id);
            }
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
