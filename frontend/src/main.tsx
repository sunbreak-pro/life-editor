import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./utils/migrateStorageKeys";
import "./i18n";
import App from "./App.tsx";
import { MobileApp } from "./MobileApp.tsx";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { ThemeProvider } from "./context/ThemeContext";
import { UndoRedoProvider } from "./context/UndoRedoContext";
import { TaskTreeProvider } from "./context/TaskTreeContext";
import { MemoProvider } from "./context/MemoContext";
import { TimerProvider } from "./context/TimerContext";
import { AudioProvider } from "./context/AudioContext";
import { NoteProvider } from "./context/NoteContext";
import { RoutineProvider } from "./context/RoutineContext";
import { ScheduleItemsProvider } from "./context/ScheduleItemsContext";
import { CalendarTagsProvider } from "./context/CalendarTagsContext";
import { CalendarProvider } from "./context/CalendarContext";
import { ShortcutConfigProvider } from "./context/ShortcutConfigContext";
import { WikiTagProvider } from "./context/WikiTagContext";
import { ToastProvider } from "./context/ToastContext";
import { ScreenLockProvider } from "./context/ScreenLockContext";
import { FileExplorerProvider } from "./context/FileExplorerContext";
import { isElectron } from "./services/dataServiceFactory";

const isMobile = !isElectron();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          {isMobile ? (
            <UndoRedoProvider>
              <TaskTreeProvider>
                <CalendarProvider>
                  <MemoProvider>
                    <NoteProvider>
                      <RoutineProvider>
                        <ScheduleItemsProvider>
                          <TimerProvider>
                            <MobileApp />
                          </TimerProvider>
                        </ScheduleItemsProvider>
                      </RoutineProvider>
                    </NoteProvider>
                  </MemoProvider>
                </CalendarProvider>
              </TaskTreeProvider>
            </UndoRedoProvider>
          ) : (
            <UndoRedoProvider>
              <ScreenLockProvider>
                <TaskTreeProvider>
                  <CalendarProvider>
                    <MemoProvider>
                      <NoteProvider>
                        <FileExplorerProvider>
                          <RoutineProvider>
                            <ScheduleItemsProvider>
                              <CalendarTagsProvider>
                                <TimerProvider>
                                  <AudioProvider>
                                    <WikiTagProvider>
                                      <ShortcutConfigProvider>
                                        <App />
                                      </ShortcutConfigProvider>
                                    </WikiTagProvider>
                                  </AudioProvider>
                                </TimerProvider>
                              </CalendarTagsProvider>
                            </ScheduleItemsProvider>
                          </RoutineProvider>
                        </FileExplorerProvider>
                      </NoteProvider>
                    </MemoProvider>
                  </CalendarProvider>
                </TaskTreeProvider>
              </ScreenLockProvider>
            </UndoRedoProvider>
          )}
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
