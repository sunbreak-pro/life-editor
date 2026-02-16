import { useState, useRef, useEffect } from "react";
import {
  PanelRight,
  Plus,
  Calendar,
  StickyNote,
  List,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { SidebarTabs, type SidebarTabItem } from "../shared/SidebarTabs";
import { useCalendarContext } from "../../hooks/useCalendarContext";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { CalendarCreateDialog } from "./CalendarCreateDialog";

type CalendarMode = "tasks" | "memo";

const CALENDAR_TABS: readonly SidebarTabItem<CalendarMode>[] = [
  { id: "tasks", labelKey: "calendarSidebar.tasksTab", icon: Calendar },
  { id: "memo", labelKey: "calendarSidebar.memoTab", icon: StickyNote },
];

interface CalendarSidebarProps {
  width: number;
  onToggle: () => void;
}

export function CalendarSidebar({ width, onToggle }: CalendarSidebarProps) {
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("tasks");
  const {
    calendars,
    activeCalendarId,
    setActiveCalendarId,
    createCalendar,
    updateCalendar,
    deleteCalendar,
  } = useCalendarContext();
  const { nodes } = useTaskTreeContext();
  const { t } = useTranslation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [contextMenuCalendarId, setContextMenuCalendarId] = useState<
    string | null
  >(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Find folder title for a calendar
  const getFolderTitle = (folderId: string) => {
    const folder = nodes.find((n) => n.id === folderId);
    return folder?.title ?? "Unknown";
  };

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenuCalendarId) return;
    const handler = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenuCalendarId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenuCalendarId]);

  // Auto-focus rename input
  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  const handleCreate = async (title: string, folderId: string) => {
    await createCalendar(title, folderId);
    setShowCreateDialog(false);
  };

  const handleRenameSubmit = async () => {
    if (renamingId && renameValue.trim()) {
      await updateCalendar(renamingId, { title: renameValue.trim() });
    }
    setRenamingId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteCalendar(id);
    setContextMenuCalendarId(null);
  };

  return (
    <div
      className="h-screen bg-notion-bg-subsidebar border-l border-notion-border flex flex-col"
      style={{ width }}
    >
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-[20px] font-semibold uppercase tracking-wider text-notion-text-secondary">
          {t("calendarSidebar.title")}
        </span>
        <div className="flex items-center gap-1">
          {calendarMode === "tasks" && (
            <button
              onClick={() => setShowCreateDialog(true)}
              className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
              title={t("calendarSidebar.newCalendar")}
            >
              <Plus size={18} />
            </button>
          )}
          <button
            onClick={onToggle}
            className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
          >
            <PanelRight size={18} />
          </button>
        </div>
      </div>

      {/* Mode tabs */}
      <SidebarTabs
        tabs={CALENDAR_TABS}
        activeTab={calendarMode}
        onTabChange={setCalendarMode}
      />

      <div className="flex-1 overflow-y-auto px-1">
        {calendarMode === "tasks" && (
          <>
            {/* All Tasks entry */}
            <button
              onClick={() => setActiveCalendarId(null)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeCalendarId === null
                  ? "bg-notion-accent/10 text-notion-accent font-medium"
                  : "text-notion-text hover:bg-notion-hover"
              }`}
            >
              <List size={14} className="shrink-0" />
              <span className="truncate">{t("calendarSidebar.allTasks")}</span>
            </button>

            {/* Calendar list */}
            {calendars.map((cal) => (
              <div key={cal.id} className="relative group">
                {renamingId === cal.id ? (
                  <div className="px-3 py-1">
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleRenameSubmit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameSubmit();
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="w-full px-2 py-0.5 text-sm bg-notion-bg-secondary border border-notion-border rounded text-notion-text focus:outline-none focus:ring-1 focus:ring-notion-accent"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveCalendarId(cal.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
                      activeCalendarId === cal.id
                        ? "bg-notion-accent/10 text-notion-accent font-medium"
                        : "text-notion-text hover:bg-notion-hover"
                    }`}
                  >
                    <Calendar size={14} className="shrink-0" />
                    <div className="flex-1 text-left truncate">
                      <div className="truncate">{cal.title}</div>
                      <div className="text-[10px] text-notion-text-secondary truncate">
                        {getFolderTitle(cal.folderId)}
                      </div>
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenuCalendarId(
                          contextMenuCalendarId === cal.id ? null : cal.id,
                        );
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-all"
                    >
                      <MoreHorizontal size={14} />
                    </div>
                  </button>
                )}

                {/* Context menu */}
                {contextMenuCalendarId === cal.id && (
                  <div
                    ref={contextMenuRef}
                    className="absolute right-2 top-8 z-20 bg-notion-bg border border-notion-border rounded-lg shadow-lg py-1 min-w-30"
                  >
                    <button
                      onClick={() => {
                        setRenamingId(cal.id);
                        setRenameValue(cal.title);
                        setContextMenuCalendarId(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-notion-text hover:bg-notion-hover"
                    >
                      <Pencil size={13} />
                      {t("calendarSidebar.rename")}
                    </button>
                    <button
                      onClick={() => handleDelete(cal.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-notion-hover"
                    >
                      <Trash2 size={13} />
                      {t("calendarSidebar.delete")}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {calendars.length === 0 && (
              <p className="px-3 py-4 text-xs text-notion-text-secondary text-center">
                {t("calendarSidebar.empty")}
              </p>
            )}
          </>
        )}
      </div>

      {showCreateDialog && (
        <CalendarCreateDialog
          onSubmit={handleCreate}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </div>
  );
}
