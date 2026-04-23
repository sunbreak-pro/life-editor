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
import { DailyProvider } from "./context/DailyContext";
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
import { TemplateProvider } from "./context/TemplateContext";
import { SyncProvider } from "./context/SyncContext";
import { isTauriMobile } from "./services/bridge";

const isMobile = isTauriMobile();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <SyncProvider>
            {isMobile ? (
              <UndoRedoProvider>
                <TaskTreeProvider>
                  <CalendarProvider>
                    <TemplateProvider>
                      <DailyProvider>
                        <NoteProvider>
                          <RoutineProvider>
                            <ScheduleItemsProvider>
                              <TimerProvider>
                                <WikiTagProvider>
                                  <MobileApp />
                                </WikiTagProvider>
                              </TimerProvider>
                            </ScheduleItemsProvider>
                          </RoutineProvider>
                        </NoteProvider>
                      </DailyProvider>
                    </TemplateProvider>
                  </CalendarProvider>
                </TaskTreeProvider>
              </UndoRedoProvider>
            ) : (
              <UndoRedoProvider>
                <ScreenLockProvider>
                  <TaskTreeProvider>
                    <CalendarProvider>
                      <TemplateProvider>
                        <DailyProvider>
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
                        </DailyProvider>
                      </TemplateProvider>
                    </CalendarProvider>
                  </TaskTreeProvider>
                </ScreenLockProvider>
              </UndoRedoProvider>
            )}
          </SyncProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
