/* eslint-disable react-refresh/only-export-components */
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { ThemeProvider } from "../context/ThemeContext";
import { TaskTreeProvider } from "../context/TaskTreeContext";
import { MemoProvider } from "../context/MemoContext";
import { NoteProvider } from "../context/NoteContext";
import { TimerProvider } from "../context/TimerContext";
import { AudioProvider } from "../context/AudioContext";
import { ScreenLockProvider } from "../context/ScreenLockContext";

function AllProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ScreenLockProvider>
        <TaskTreeProvider>
          <MemoProvider>
            <NoteProvider>
              <TimerProvider>
                <AudioProvider>{children}</AudioProvider>
              </TimerProvider>
            </NoteProvider>
          </MemoProvider>
        </TaskTreeProvider>
      </ScreenLockProvider>
    </ThemeProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}
