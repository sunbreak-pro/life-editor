import { useState, useRef } from "react";
import { Layout } from "./components/Layout";
import type { LayoutHandle } from "./components/Layout";
import { TaskTree } from "./components/TaskTree";
import { TaskTreeHeader } from "./components/TaskTree/TaskTreeHeader";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { WorkScreen } from "./components/WorkScreen";
import { SessionCompletionModal } from "./components/WorkScreen/SessionCompletionModal";
import { Settings } from "./components/Settings";
import { Tips } from "./components/Tips";
import { CalendarView } from "./components/Calendar/CalendarView";
import { AnalyticsView } from "./components/Analytics/AnalyticsView";
import { MemoView } from "./components/Memo";
import { CommandPalette } from "./components/CommandPalette/CommandPalette";
import { UpdateNotification } from "./components/UpdateNotification";
import { useTimerContext } from "./hooks/useTimerContext";
import { useTaskTreeContext } from "./hooks/useTaskTreeContext";
import { useMemoContext } from "./hooks/useMemoContext";
import { useAppCommands } from "./hooks/useAppCommands";
import { useAppKeyboardShortcuts } from "./hooks/useAppKeyboardShortcuts";
import { useElectronMenuActions } from "./hooks/useElectronMenuActions";
import { useTaskDetailHandlers } from "./hooks/useTaskDetailHandlers";
import { useNoteContext } from "./hooks/useNoteContext";

import type { SectionId } from "./types/taskTree";
import { STORAGE_KEYS } from "./constants/storageKeys";

function App() {
  const [activeSection, setActiveSection] = useState<SectionId>("tasks");
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
  const { createNote } = useNoteContext();

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
    setMemoDate,
    createNote,
  });

  const commands = useAppCommands({
    setActiveSection,
    addNode,
    selectedTask,
    softDelete,
    setSelectedTaskId,
    timer,
    layoutRef,
  });

  useAppKeyboardShortcuts({
    timer,
    selectedTask,
    addNode,
    setActiveSection,
    setIsCommandPaletteOpen,
    handleDeleteSelectedTask: handlers.handleDeleteSelectedTask,
  });

  useElectronMenuActions({
    addNode,
    setActiveSection,
    layoutRef,
  });

  const renderContent = () => {
    switch (activeSection) {
      case "tasks":
        return (
          <div className="h-full flex flex-col">
            <TaskTreeHeader
              filterFolderId={filterFolderId}
              onFilterChange={setFilterFolderId}
            />
            <div className="flex-1 overflow-y-auto">
              <TaskTree
                onPlayTask={handlers.handlePlayTask}
                onSelectTask={setSelectedTaskId}
                selectedTaskId={selectedTaskId}
                filterFolderId={filterFolderId}
                onFilterChange={setFilterFolderId}
              />
            </div>
          </div>
        );
      case "memo":
        return <MemoView />;
      case "work":
        return <WorkScreen onCompleteTask={handlers.handleCompleteTask} />;
      case "schedule":
        return (
          <CalendarView
            onSelectTask={handlers.handleCalendarSelectTask}
            onCreateTask={handlers.handleCalendarCreateTask}
            onCreateNote={handlers.handleCalendarCreateNote}
            onSelectMemo={handlers.handleCalendarSelectMemo}
            onSelectNote={handlers.handleCalendarSelectNote}
            onStartTimer={(taskId) => {
              const task = nodes.find((n) => n.id === taskId);
              if (task) handlers.handlePlayTask(task);
            }}
          />
        );
      case "analytics":
        return <AnalyticsView />;
      case "settings":
        return <Settings />;
      case "tips":
        return <Tips />;
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
        onPlayTask={handlers.handlePlayTask}
        selectedTaskId={selectedTaskId}
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
