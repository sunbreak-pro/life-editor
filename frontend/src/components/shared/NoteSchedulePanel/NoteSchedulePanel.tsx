import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import type { NoteNode } from "../../../types/note";
import { TimeSettingsInline } from "../TaskSchedulePanel/TimeSettingsInline";
import { ExistingNoteTab } from "./ExistingNoteTab";
import { NewNoteTab } from "./NewNoteTab";

interface NoteSchedulePanelProps {
  position: { x: number; y: number };
  defaultStartTime: string;
  defaultEndTime: string;
  date: Date;
  onSelectExistingNote: (
    note: NoteNode,
    startTime: string,
    endTime: string,
  ) => void;
  onCreateNewNote: (title: string, startTime: string, endTime: string) => void;
  onClose: () => void;
}

export function NoteSchedulePanel({
  position,
  defaultStartTime,
  defaultEndTime,
  onSelectExistingNote,
  onCreateNewNote,
  onClose,
}: NoteSchedulePanelProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const [isAllDay, setIsAllDay] = useState(false);
  const [hasEndTime, setHasEndTime] = useState(true);

  const handleSelectExisting = useCallback(
    (note: NoteNode) => {
      onSelectExistingNote(note, startTime, endTime);
    },
    [startTime, endTime, onSelectExistingNote],
  );

  const handleCreateNew = useCallback(
    (title: string) => {
      onCreateNewNote(title, startTime, endTime);
    },
    [startTime, endTime, onCreateNewNote],
  );

  const panelWidth = 320;
  const panelHeight = 420;
  const left = Math.min(position.x, window.innerWidth - panelWidth - 8);
  const top = Math.min(position.y, window.innerHeight - panelHeight - 8);

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="absolute bg-notion-bg border border-notion-border rounded-lg shadow-xl flex flex-col"
        style={{ top, left, width: panelWidth, maxHeight: panelHeight }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-notion-border">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("existing")}
              className={`text-sm ${tab === "existing" ? "text-notion-text font-medium" : "text-notion-text-secondary"}`}
            >
              {t("schedulePanel.existingNote", "Existing Note")}
            </button>
            <span className="text-notion-border">|</span>
            <button
              onClick={() => setTab("new")}
              className={`text-sm ${tab === "new" ? "text-notion-text font-medium" : "text-notion-text-secondary"}`}
            >
              {t("schedulePanel.newNote", "New Note")}
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Time settings */}
        <div className="px-3 py-2 border-b border-notion-border">
          <TimeSettingsInline
            startTime={startTime}
            endTime={endTime}
            isAllDay={isAllDay}
            hasEndTime={hasEndTime}
            onStartTimeChange={setStartTime}
            onEndTimeChange={setEndTime}
            onAllDayChange={setIsAllDay}
            onHasEndTimeChange={setHasEndTime}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {tab === "existing" ? (
            <ExistingNoteTab onSelect={handleSelectExisting} />
          ) : (
            <NewNoteTab onSubmit={handleCreateNew} />
          )}
        </div>
      </div>
    </div>
  );
}
