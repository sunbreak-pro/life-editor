import { useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTaskTreeContext } from "../../../../hooks/useTaskTreeContext";
import { flattenFolders } from "../../../../utils/flattenFolders";

interface CalendarCreateDialogProps {
  onSubmit: (title: string, folderId: string) => void;
  onClose: () => void;
}

export function CalendarCreateDialog({
  onSubmit,
  onClose,
}: CalendarCreateDialogProps) {
  const { t } = useTranslation();
  const { nodes } = useTaskTreeContext();
  const folders = flattenFolders(nodes);
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState(folders[0]?.id ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !folderId) return;
    onSubmit(title.trim(), folderId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        onSubmit={handleSubmit}
        className="bg-notion-bg border border-notion-border rounded-lg shadow-xl w-80 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-notion-text">
            {t("calendarCreate.title")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <label className="block text-xs text-notion-text-secondary mb-1">
          {t("calendarCreate.titleLabel")}
        </label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("calendarCreate.placeholder")}
          className="w-full px-2 py-1.5 mb-3 text-sm bg-notion-bg-secondary border border-notion-border rounded text-notion-text placeholder:text-notion-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-notion-accent"
        />

        <label className="block text-xs text-notion-text-secondary mb-1">
          {t("calendarCreate.folderLabel")}
        </label>
        {folders.length === 0 ? (
          <p className="text-xs text-notion-text-secondary mb-3">
            {t("calendarCreate.noFolders")}
          </p>
        ) : (
          <select
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            className="w-full px-2 py-1.5 mb-3 text-sm bg-notion-bg-secondary border border-notion-border rounded text-notion-text focus:outline-none focus:ring-1 focus:ring-notion-accent"
          >
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.path}
              </option>
            ))}
          </select>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-notion-text-secondary hover:text-notion-text rounded transition-colors"
          >
            {t("calendarCreate.cancel")}
          </button>
          <button
            type="submit"
            disabled={!title.trim() || !folderId}
            className="px-3 py-1.5 text-xs bg-notion-accent text-white rounded hover:bg-notion-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t("calendarCreate.create")}
          </button>
        </div>
      </form>
    </div>
  );
}
