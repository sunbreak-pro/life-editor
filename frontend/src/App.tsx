import { useState, useRef } from "react";
import { Layout } from "./components/Layout";
import type { LayoutHandle } from "./components/Layout";
import { ScheduleSection } from "./components/Schedule/ScheduleSection";
import type { ScheduleTab } from "./components/Schedule/ScheduleSection";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { WorkScreen } from "./components/Work";
import { SessionCompletionModal } from "./components/Work/SessionCompletionModal";
import { Settings } from "./components/Settings";
import { AnalyticsView } from "./components/Analytics/AnalyticsView";
import { ConnectView } from "./components/Ideas";
import { MaterialsView } from "./components/Materials/MaterialsView";
import { CommandPalette } from "./components/CommandPalette/CommandPalette";
import { UpdateNotification } from "./components/UpdateNotification";
import { useTimerContext } from "./hooks/useTimerContext";
import { useTaskTreeContext } from "./hooks/useTaskTreeContext";
import { useMemoContext } from "./hooks/useMemoContext";
import { useAppCommands } from "./hooks/useAppCommands";
import { useAppKeyboardShortcuts } from "./hooks/useAppKeyboardShortcuts";
import { useElectronMenuActions } from "./hooks/useElectronMenuActions";
import { useTaskDetailHandlers } from "./hooks/useTaskDetailHandlers";
import { useUndoRedoKeyboard } from "./components/shared/UndoRedo";
import { useNoteContext } from "./hooks/useNoteContext";
import type { SectionId } from "./types/taskTree";
import { STORAGE_KEYS } from "./constants/storageKeys";

function App() {
  const [activeSection, setActiveSection] = useState<SectionId>("schedule");
  const [scheduleTab, setScheduleTab] = useState<ScheduleTab>("calendar");
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [filterFolderId, setFilterFolderId] = useLocalStorage<string | null>(
    STORAGE_KEYS.TASK_TREE_FOLDER_FILTER,
    null,
    { serialize: (v) => v ?? "", deserialize: (v) => v || null },
  );
  const layoutRef = useRef<LayoutHandle | null>(null);
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

  useAppKeyboardShortcuts({
    timer,
    addNode,
    setActiveSection,
    setIsCommandPaletteOpen,
    selectedTaskId,
    nodes,
    activeSection,
  });

  useElectronMenuActions({
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
          <ConnectView
            onNavigateToNote={() => {
              localStorage.setItem(STORAGE_KEYS.MATERIALS_TAB, "notes");
            }}
          />
        );
      case "work":
        return <WorkScreen onCompleteTask={handlers.handleCompleteTask} />;
      case "analytics":
        return <AnalyticsView />;
      case "settings":
        return <Settings />;
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
