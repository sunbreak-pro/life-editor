import { useState } from "react";
import { useTranslation } from "react-i18next";

interface NewNoteTabProps {
  onSubmit: (title: string) => void;
}

export function NewNoteTab({ onSubmit }: NewNoteTabProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("schedulePanel.noteTitle", "Note title")}
        className="w-full px-2 py-1.5 text-sm bg-notion-bg-secondary border border-notion-border rounded focus:outline-none focus:ring-1 focus:ring-notion-blue text-notion-text"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim()) {
            onSubmit(title.trim());
          }
        }}
      />
      <button
        onClick={() => title.trim() && onSubmit(title.trim())}
        disabled={!title.trim()}
        className="px-3 py-1.5 text-sm bg-notion-blue text-white rounded hover:bg-notion-blue/90 disabled:opacity-50 transition-colors"
      >
        {t("schedule.create", "Create")}
      </button>
    </div>
  );
}
