import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

const CATPPUCCIN_MOCHA = {
  background: "#11111b",
  foreground: "#cdd6f4",
  cursor: "#f5e0dc",
  cursorAccent: "#11111b",
  selectionBackground: "#585b7066",
  selectionForeground: "#cdd6f4",
  black: "#45475a",
  red: "#f38ba8",
  green: "#a6e3a1",
  yellow: "#f9e2af",
  blue: "#89b4fa",
  magenta: "#f5c2e7",
  cyan: "#94e2d5",
  white: "#bac2de",
  brightBlack: "#585b70",
  brightRed: "#f38ba8",
  brightGreen: "#a6e3a1",
  brightYellow: "#f9e2af",
  brightBlue: "#89b4fa",
  brightMagenta: "#f5c2e7",
  brightCyan: "#94e2d5",
  brightWhite: "#a6adc8",
};

interface TerminalPaneProps {
  sessionId: string;
  onFocus?: () => void;
  isActive?: boolean;
}

export function TerminalPane({ sessionId, onFocus }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: CATPPUCCIN_MOCHA,
      fontFamily: '"JetBrains Mono", "Fira Code", "Menlo", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    // Delay fit to ensure container is measured
    requestAnimationFrame(() => {
      fitAddon.fit();
      window.electronAPI?.invoke(
        "terminal:resize",
        sessionId,
        term.cols,
        term.rows,
      );
    });

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Custom key event handler for macOS shortcuts
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      // shift+Enter must be blocked for all event types (keydown + keypress)
      // to prevent xterm from also sending a normal Enter (\r)
      if (e.shiftKey && !e.metaKey && e.code === "Enter") {
        if (e.type === "keydown") {
          window.electronAPI?.invoke("terminal:write", sessionId, "\x16\n");
        }
        return false;
      }

      // Backspace → send \x7f directly to PTY (bypass xterm internal handling)
      // Ensures correct behavior after shift+Enter newline insertion
      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.code === "Backspace") {
        if (e.type === "keydown") {
          window.electronAPI?.invoke("terminal:write", sessionId, "\x7f");
        }
        return false;
      }

      if (e.type !== "keydown") return true;

      // cmd+backspace → line clear (\x15 = Ctrl+U)
      if (e.metaKey && e.code === "Backspace") {
        window.electronAPI?.invoke("terminal:write", sessionId, "\x15");
        return false;
      }
      // cmd+→ → End key (xterm-256color)
      if (e.metaKey && e.code === "ArrowRight") {
        window.electronAPI?.invoke("terminal:write", sessionId, "\x1bOF");
        return false;
      }
      // cmd+← → Home key (xterm-256color)
      if (e.metaKey && e.code === "ArrowLeft") {
        window.electronAPI?.invoke("terminal:write", sessionId, "\x1bOH");
        return false;
      }
      // cmd+z → Undo (readline/zsh Ctrl+_)
      if (e.metaKey && !e.shiftKey && e.code === "KeyZ") {
        window.electronAPI?.invoke("terminal:write", sessionId, "\x1f");
        return false;
      }
      // cmd+↑ → beginning-of-buffer-or-history (ESC-<)
      if (e.metaKey && e.code === "ArrowUp") {
        window.electronAPI?.invoke("terminal:write", sessionId, "\x1b<");
        return false;
      }
      // cmd+↓ → end-of-buffer-or-history (ESC->)
      if (e.metaKey && e.code === "ArrowDown") {
        window.electronAPI?.invoke("terminal:write", sessionId, "\x1b>");
        return false;
      }
      // cmd+j/w/t/d → let DOM handle these (panel-level shortcuts)
      if (e.metaKey && ["KeyJ", "KeyW", "KeyT", "KeyD"].includes(e.code)) {
        return false;
      }
      return true;
    });

    // Handle user input → IPC write
    const onDataDispose = term.onData((data) => {
      window.electronAPI?.invoke("terminal:write", sessionId, data);
    });

    // Handle PTY output → term write
    const cleanup = window.electronAPI?.onTerminalData(
      (sid: string, data: string) => {
        if (sid === sessionId) {
          term.write(data);
        }
      },
    );

    // ResizeObserver → fit + IPC resize
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitAddon.fit();
        window.electronAPI?.invoke(
          "terminal:resize",
          sessionId,
          term.cols,
          term.rows,
        );
      });
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      onDataDispose.dispose();
      cleanup?.();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ backgroundColor: CATPPUCCIN_MOCHA.background }}
      onFocus={onFocus}
      onClick={onFocus}
    />
  );
}
