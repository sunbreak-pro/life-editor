import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./utils/migrateStorageKeys";
import "./i18n";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { ThemeProvider } from "./context/ThemeContext";
import { UndoRedoProvider } from "./components/shared/UndoRedo";
import { TaskTreeProvider } from "./context/TaskTreeContext";
import { MemoProvider } from "./context/MemoContext";
import { TimerProvider } from "./context/TimerContext";
import { AudioProvider } from "./context/AudioContext";
import { NoteProvider } from "./context/NoteContext";
import { ScheduleProvider } from "./context/ScheduleContext";
import { CalendarProvider } from "./context/CalendarContext";
import { ShortcutConfigProvider } from "./hooks/useShortcutConfig";
import { WikiTagProvider } from "./context/WikiTagContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <UndoRedoProvider>
          <TaskTreeProvider>
            <CalendarProvider>
              <MemoProvider>
                <NoteProvider>
                  <ScheduleProvider>
                    <TimerProvider>
                      <AudioProvider>
                        <WikiTagProvider>
                          <ShortcutConfigProvider>
                            <App />
                          </ShortcutConfigProvider>
                        </WikiTagProvider>
                      </AudioProvider>
                    </TimerProvider>
                  </ScheduleProvider>
                </NoteProvider>
              </MemoProvider>
            </CalendarProvider>
          </TaskTreeProvider>
        </UndoRedoProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
