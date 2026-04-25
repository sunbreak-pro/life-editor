import { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X, Check, Search } from "lucide-react";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { useCalendarTagsContext } from "../../hooks/useCalendarTagsContext";
import { CalendarTagSelector } from "../Schedule/CalendarTagSelector";
import { setFreeSessionSaveDialogEnabled } from "../../utils/pomodoroSettings";

interface FreeSessionSaveDialogProps {
  elapsedSeconds: number;
  onSave: (input: {
    label: string;
    role: "task" | "event" | null;
    parentTaskId?: string | null;
    calendarTagId?: number | null;
  }) => Promise<void>;
  onDiscard: () => Promise<void>;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export function FreeSessionSaveDialog({
  elapsedSeconds,
  onSave,
  onDiscard,
}: FreeSessionSaveDialogProps) {
  const { t } = useTranslation();
  const { nodes } = useTaskTreeContext();
  const { calendarTags } = useCalendarTagsContext();

  const [label, setLabel] = useState("");
  const [role, setRole] = useState<"task" | "event">("task");
  const [parentTaskId, setParentTaskId] = useState<string | null>(null);
  const [parentSearch, setParentSearch] = useState("");
  const [calendarTagId, setCalendarTagId] = useState<number | null>(null);
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const taskCandidates = useMemo(() => {
    const q = parentSearch.trim().toLowerCase();
    return nodes
      .filter((n) => !n.isDeleted)
      .filter((n) => (q === "" ? true : n.title.toLowerCase().includes(q)))
      .slice(0, 30);
  }, [nodes, parentSearch]);

  const selectedParent = useMemo(
    () => nodes.find((n) => n.id === parentTaskId) ?? null,
    [nodes, parentTaskId],
  );

  const handleSave = useCallback(async () => {
    if (!label.trim() || submitting) return;
    setSubmitting(true);
    if (doNotShowAgain) setFreeSessionSaveDialogEnabled(false);
    try {
      await onSave({
        label: label.trim(),
        role,
        parentTaskId: role === "task" ? parentTaskId : null,
        calendarTagId: role === "event" ? calendarTagId : null,
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    label,
    role,
    parentTaskId,
    calendarTagId,
    doNotShowAgain,
    submitting,
    onSave,
  ]);

  const handleDiscard = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    if (doNotShowAgain) setFreeSessionSaveDialogEnabled(false);
    try {
      await onDiscard();
    } finally {
      setSubmitting(false);
    }
  }, [doNotShowAgain, submitting, onDiscard]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-96 max-w-[90vw] bg-notion-bg border border-notion-border rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-notion-border">
          <div>
            <div className="text-sm font-medium text-notion-text">
              {t("freeSession.saveTitle", "Save free session?")}
            </div>
            <div className="text-[11px] text-notion-text-secondary mt-0.5">
              {t("freeSession.elapsedLabel", "Elapsed")}:{" "}
              {formatElapsed(elapsedSeconds)}
            </div>
          </div>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={submitting}
            className="p-1 rounded hover:bg-notion-hover text-notion-text-secondary"
            aria-label={t("common.close", "Close")}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3">
          {/* Label */}
          <div>
            <label className="block text-[10px] text-notion-text-secondary mb-1 uppercase tracking-wide">
              {t("freeSession.nameLabel", "Name")}
            </label>
            <input
              autoFocus
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t(
                "freeSession.namePlaceholder",
                "What did you work on?",
              )}
              className="w-full px-2 py-1.5 text-xs bg-notion-bg-secondary border border-notion-border rounded-md text-notion-text outline-none focus:border-notion-accent/50 transition-colors"
            />
          </div>

          {/* Role selector */}
          <div>
            <label className="block text-[10px] text-notion-text-secondary mb-1 uppercase tracking-wide">
              {t("freeSession.roleLabel", "Save as")}
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setRole("task")}
                className={`flex-1 px-2 py-1.5 text-xs rounded-md border transition-colors ${
                  role === "task"
                    ? "border-notion-accent bg-notion-accent/10 text-notion-accent"
                    : "border-notion-border text-notion-text-secondary hover:bg-notion-hover"
                }`}
              >
                {t("freeSession.roleTask", "Task")}
              </button>
              <button
                type="button"
                onClick={() => setRole("event")}
                className={`flex-1 px-2 py-1.5 text-xs rounded-md border transition-colors ${
                  role === "event"
                    ? "border-notion-accent bg-notion-accent/10 text-notion-accent"
                    : "border-notion-border text-notion-text-secondary hover:bg-notion-hover"
                }`}
              >
                {t("freeSession.roleEvent", "Event")}
              </button>
            </div>
          </div>

          {/* Role-specific fields */}
          {role === "task" && (
            <div>
              <label className="block text-[10px] text-notion-text-secondary mb-1 uppercase tracking-wide">
                {t("freeSession.parentLabel", "Save under")}
              </label>
              <div className="relative">
                <Search
                  size={11}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-notion-text-secondary"
                />
                <input
                  type="text"
                  value={selectedParent ? selectedParent.title : parentSearch}
                  onChange={(e) => {
                    setParentSearch(e.target.value);
                    setParentTaskId(null);
                  }}
                  placeholder={t(
                    "freeSession.parentPlaceholder",
                    "Search task / folder (root if blank)",
                  )}
                  className="w-full pl-7 pr-2 py-1.5 text-xs bg-notion-bg-secondary border border-notion-border rounded-md text-notion-text outline-none focus:border-notion-accent/50"
                />
              </div>
              {parentSearch.trim() !== "" && !selectedParent && (
                <div className="mt-1 max-h-32 overflow-y-auto bg-notion-bg-popover border border-notion-border rounded-md">
                  {taskCandidates.length === 0 ? (
                    <div className="px-2 py-1 text-[11px] text-notion-text-secondary italic">
                      {t("freeSession.noTasks", "No matching task")}
                    </div>
                  ) : (
                    taskCandidates.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          setParentTaskId(n.id);
                          setParentSearch("");
                        }}
                        className="w-full text-left px-2 py-1 text-xs hover:bg-notion-hover"
                      >
                        <span className="text-notion-text-secondary mr-1.5">
                          {n.type === "folder" ? "📁" : "•"}
                        </span>
                        {n.title}
                      </button>
                    ))
                  )}
                </div>
              )}
              {selectedParent && (
                <button
                  type="button"
                  onClick={() => setParentTaskId(null)}
                  className="mt-1 text-[10px] text-notion-accent hover:underline"
                >
                  {t("common.clear", "Clear")}
                </button>
              )}
            </div>
          )}

          {role === "event" && (
            <div>
              <label className="block text-[10px] text-notion-text-secondary mb-1 uppercase tracking-wide">
                {t("freeSession.tagLabel", "Tag")}
              </label>
              <CalendarTagSelector
                tags={calendarTags}
                selectedTagId={calendarTagId}
                onSelect={setCalendarTagId}
              />
            </div>
          )}

          {/* Don't show again */}
          <label className="flex items-center gap-1.5 text-[11px] text-notion-text-secondary cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={doNotShowAgain}
              onChange={(e) => setDoNotShowAgain(e.target.checked)}
              className="cursor-pointer"
            />
            {t("freeSession.doNotShowAgain", "Don't show this again")}
          </label>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-notion-border">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={submitting}
            className="px-3 py-1.5 text-xs text-notion-text-secondary hover:bg-notion-hover rounded-md transition-colors disabled:opacity-50"
          >
            {t("freeSession.discard", "Discard")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!label.trim() || submitting}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-notion-accent text-white rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Check size={11} />
            {t("common.save", "Save")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
