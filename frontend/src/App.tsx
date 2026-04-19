import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { Layout } from "./components/Layout";
import type {
  LayoutHandle,
  TerminalCommandHandle,
} from "./components/Layout/Layout";
import { ScheduleSection } from "./components/Schedule/ScheduleSection";
import type { ScheduleTab } from "./components/Schedule/ScheduleSection";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { SessionCompletionModal } from "./components/Work/SessionCompletionModal";
import type { SettingsInitialTab } from "./components/Settings";
import { MaterialsView } from "./components/Materials/MaterialsView";
import { CommandPalette } from "./components/CommandPalette/CommandPalette";
import { UpdateNotification } from "./components/UpdateNotification";

const WorkScreen = lazy(() =>
  import("./components/Work").then((m) => ({ default: m.WorkScreen })),
);
const Settings = lazy(() =>
  import("./components/Settings").then((m) => ({ default: m.Settings })),
);
const AnalyticsView = lazy(() =>
  import("./components/Analytics/AnalyticsView").then((m) => ({
    default: m.AnalyticsView,
  })),
);
const ConnectView = lazy(() =>
  import("./components/Ideas").then((m) => ({ default: m.ConnectView })),
);
import { useTimerContext } from "./hooks/useTimerContext";
import { useTaskTreeContext } from "./hooks/useTaskTreeContext";
import { useMemoContext } from "./hooks/useMemoContext";
import { useAppCommands } from "./hooks/useAppCommands";
import { useAppKeyboardShortcuts } from "./hooks/useAppKeyboardShortcuts";
import { useMenuActions } from "./hooks/useMenuActions";
import { useTaskDetailHandlers } from "./hooks/useTaskDetailHandlers";
import { useUndoRedoKeyboard } from "./components/shared/UndoRedo";
import { useNoteContext } from "./hooks/useNoteContext";
import { useReminderListener } from "./hooks/useReminderListener";
import type { SectionId } from "./types/taskTree";
import { STORAGE_KEYS } from "./constants/storageKeys";
import {
  NAVIGATE_TO_NOTE_EVENT,
  type NavigateToNoteDetail,
} from "./constants/events";

function App() {
  const [activeSection, setActiveSection] = useState<SectionId>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STARTUP_SCREEN);
    if (
      saved &&
      ["schedule", "materials", "connect", "work", "analytics"].includes(saved)
    ) {
      return saved as SectionId;
    }
    return "schedule";
  });
  const [scheduleTab, setScheduleTab] = useState<ScheduleTab>("calendar");
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    SettingsInitialTab | undefined
  >(undefined);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [filterFolderId, setFilterFolderId] = useLocalStorage<string | null>(
    STORAGE_KEYS.TASK_TREE_FOLDER_FILTER,
    null,
    { serialize: (v) => v ?? "", deserialize: (v) => v || null },
  );
  const layoutRef = useRef<LayoutHandle | null>(null);
  const terminalCommandRef = useRef<TerminalCommandHandle | null>(null);
  const timer = useTimerContext();
  const {
    nodes,
    addNode,
    updateNode,
    softDelete,
    toggleTaskStatus,
    persistError,
  } = useTaskTreeContext();
  const { setSelectedDate: setMemoDate } = useMemoContext();
  const { createNote, setSelectedNoteId } = useNoteContext();

  const selectedTask = selectedTaskId
    ? (nodes.find((n) => n.id === selectedTaskId && n.type === "task") ?? null)
    : null;

  const handlers = useTaskDetailHandlers({
    selectedTaskId,
    selectedTask,
    timer,
    updateNode,
    addNode,
    softDelete,
    toggleTaskStatus,
    setSelectedTaskId,
    setActiveSection,
    setScheduleTab,
    setMemoDate,
    createNote,
    setSelectedNoteId,
  });

  const commands = useAppCommands({
    setActiveSection,
    setSettingsInitialTab,
    addNode,
    selectedTask,
    softDelete,
    setSelectedTaskId,
    timer,
    layoutRef,
    nodes,
    selectedTaskId,
  });

  useUndoRedoKeyboard();
  useReminderListener();

  useEffect(() => {
    const handler = (event: Event) => {
      const { detail } = event as CustomEvent<NavigateToNoteDetail>;
      if (!detail?.noteId) return;
      localStorage.setItem(STORAGE_KEYS.MATERIALS_TAB, "notes");
      setActiveSection("materials");
      setSelectedNoteId(detail.noteId);
    };
    window.addEventListener(NAVIGATE_TO_NOTE_EVENT, handler);
    return () => window.removeEventListener(NAVIGATE_TO_NOTE_EVENT, handler);
  }, [setSelectedNoteId]);

  useAppKeyboardShortcuts({
    timer,
    addNode,
    setActiveSection,
    setIsCommandPaletteOpen,
    selectedTaskId,
    nodes,
    activeSection,
  });

  useMenuActions({
    addNode,
    setActiveSection,
    layoutRef,
    selectedTaskId,
    nodes,
  });

  const renderContent = () => {
    switch (activeSection) {
      case "schedule":
        return (
          <ScheduleSection
            activeTab={scheduleTab}
            onTabChange={setScheduleTab}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
            filterFolderId={filterFolderId}
            onFilterChange={setFilterFolderId}
            onPlayTask={handlers.handlePlayTask}
            onCalendarSelectTask={(taskId) =>
              handlers.handleCalendarSelectTask(taskId)
            }
            onCreateTask={handlers.handleCalendarCreateTask}
            onSelectMemo={handlers.handleCalendarSelectMemo}
            onSelectNote={handlers.handleCalendarSelectNote}
            onCreateNote={handlers.handleCalendarCreateNote}
          />
        );
      case "materials":
        return <MaterialsView />;
      case "connect":
        return (
          <Suspense fallback={null}>
            <ConnectView
              onNavigateToNote={() => {
                localStorage.setItem(STORAGE_KEYS.MATERIALS_TAB, "notes");
                setActiveSection("materials");
              }}
              onNavigateToMemo={() => {
                setActiveSection("materials");
              }}
            />
          </Suspense>
        );
      case "work":
        return (
          <Suspense fallback={null}>
            <WorkScreen onCompleteTask={handlers.handleCompleteTask} />
          </Suspense>
        );
      case "analytics":
        return (
          <Suspense fallback={null}>
            <AnalyticsView />
          </Suspense>
        );
      case "settings":
        return (
          <Suspense fallback={null}>
            <Settings initialTab={settingsInitialTab} />
          </Suspense>
        );
      case "terminal":
        return null;
      default:
        return null;
    }
  };

  return (
    <>
      <UpdateNotification />
      {persistError && (
        <div className="fixed top-0 left-0 right-0 z-9999 bg-red-600 text-white text-sm px-4 py-2 text-center">
          Save failed: {persistError}
        </div>
      )}
      <Layout
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        handleRef={layoutRef}
        terminalCommandRef={terminalCommandRef}
      >
        {renderContent()}
      </Layout>

      {timer.showCompletionModal && timer.completedSessionType && (
        <SessionCompletionModal
          completedSessionType={timer.completedSessionType}
          onExtend={timer.extendWork}
          onStartRest={timer.startRest}
          onStartWork={() => {
            timer.dismissCompletionModal();
            timer.start();
          }}
          onDismiss={timer.dismissCompletionModal}
          onCompleteTask={
            timer.activeTask ? handlers.handleCompleteTask : undefined
          }
          autoStartBreaks={timer.autoStartBreaks}
        />
      )}

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commands}
      />
    </>
  );
}

export default App;
