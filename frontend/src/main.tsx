import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
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
                        <App />
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
