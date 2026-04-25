import type { ReactNode } from "react";
import { AudioProvider } from "../context/AudioContext";
import { CalendarProvider } from "../context/CalendarContext";
import { CalendarTagsProvider } from "../context/CalendarTagsContext";
import { DailyProvider } from "../context/DailyContext";
import { FileExplorerProvider } from "../context/FileExplorerContext";
import { NoteProvider } from "../context/NoteContext";
import { RoutineProvider } from "../context/RoutineContext";
import { ScheduleItemsProvider } from "../context/ScheduleItemsContext";
import { ScreenLockProvider } from "../context/ScreenLockContext";
import { ShortcutConfigProvider } from "../context/ShortcutConfigContext";
import { TaskTreeProvider } from "../context/TaskTreeContext";
import { TemplateProvider } from "../context/TemplateContext";
import { TimerProvider } from "../context/TimerContext";
import { UndoRedoProvider } from "../context/UndoRedoContext";
import { WikiTagProvider } from "../context/WikiTagContext";

/**
 * Provider tree for the Tauri desktop build.
 *
 * Order is load-bearing — see `.claude/CLAUDE.md §6.2`. Inner providers may
 * read outer contexts (e.g. ScheduleItemsProvider → RoutineProvider,
 * AudioProvider → TimerProvider). Reordering surfaces as `useFooContext`
 * returning null at runtime.
 *
 * The shared outer chain (ErrorBoundary → Theme → Toast → Sync) is wired
 * in `main.tsx`.
 */
export function DesktopProviders({ children }: { children: ReactNode }) {
  return (
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
              </DailyProvider>
            </TemplateProvider>
          </CalendarProvider>
        </TaskTreeProvider>
      </ScreenLockProvider>
    </UndoRedoProvider>
  );
}
