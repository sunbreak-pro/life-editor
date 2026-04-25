import type { ReactNode } from "react";
import { CalendarProvider } from "../context/CalendarContext";
import { DailyProvider } from "../context/DailyContext";
import { NoteProvider } from "../context/NoteContext";
import { RoutineProvider } from "../context/RoutineContext";
import { ScheduleItemsProvider } from "../context/ScheduleItemsContext";
import { SidebarLinksProvider } from "../context/SidebarLinksContext";
import { TaskTreeProvider } from "../context/TaskTreeContext";
import { TemplateProvider } from "../context/TemplateContext";
import { TimerProvider } from "../context/TimerContext";
import { UndoRedoProvider } from "../context/UndoRedoContext";
import { WikiTagProvider } from "../context/WikiTagContext";

/**
 * Provider tree for the iOS / Tauri mobile build.
 *
 * Order is load-bearing — see `.claude/CLAUDE.md §6.2`. Inner providers may
 * read outer contexts (e.g. ScheduleItemsProvider depends on RoutineProvider,
 * TimerProvider depends on Daily/Note for cross-cutting state). Reordering
 * surfaces as `useFooContext` returning null at runtime.
 *
 * Mobile omits these Desktop-only providers:
 *   ScreenLock, FileExplorer, CalendarTags, Audio, ShortcutConfig
 *
 * The shared outer chain (ErrorBoundary → Theme → Toast → Sync) is wired
 * in `main.tsx`. Anything depending on `useToast` / `useSync` therefore
 * works inside this tree.
 */
export function MobileProviders({ children }: { children: ReactNode }) {
  return (
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
                        <SidebarLinksProvider>{children}</SidebarLinksProvider>
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
  );
}
