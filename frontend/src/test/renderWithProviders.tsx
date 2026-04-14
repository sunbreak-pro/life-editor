/* eslint-disable react-refresh/only-export-components */
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { ThemeProvider } from "../context/ThemeContext";
import { ToastProvider } from "../context/ToastContext";
import { UndoRedoProvider } from "../context/UndoRedoContext";
import { ScreenLockProvider } from "../context/ScreenLockContext";
import { TaskTreeProvider } from "../context/TaskTreeContext";
import { CalendarProvider } from "../context/CalendarContext";
import { MemoProvider } from "../context/MemoContext";
import { NoteProvider } from "../context/NoteContext";
import { FileExplorerProvider } from "../context/FileExplorerContext";
import { RoutineProvider } from "../context/RoutineContext";
import { ScheduleItemsProvider } from "../context/ScheduleItemsContext";
import { CalendarTagsProvider } from "../context/CalendarTagsContext";
import { TimerProvider } from "../context/TimerContext";
import { AudioProvider } from "../context/AudioContext";
import { WikiTagProvider } from "../context/WikiTagContext";
import { ShortcutConfigProvider } from "../context/ShortcutConfigContext";
import { TemplateProvider } from "../context/TemplateContext";

function AllProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <UndoRedoProvider>
          <ScreenLockProvider>
            <TaskTreeProvider>
              <CalendarProvider>
                <TemplateProvider>
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
                                      {children}
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
                </TemplateProvider>
              </CalendarProvider>
            </TaskTreeProvider>
          </ScreenLockProvider>
        </UndoRedoProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}
