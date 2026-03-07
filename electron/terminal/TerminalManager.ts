import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as pty from "node-pty";
import type { BrowserWindow } from "electron";
import log from "../logger";
import { ClaudeDetector } from "./ClaudeDetector";

const BATCH_INTERVAL_MS = 16;

interface Session {
  pty: pty.IPty;
  buffer: string;
  timer: ReturnType<typeof setTimeout> | null;
  claudeDetector: ClaudeDetector;
}

export class TerminalManager {
  private sessions = new Map<string, Session>();
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win;
  }

  create(): string {
    const sessionId = `terminal-${Date.now()}`;
    const shell = process.env.SHELL || "/bin/zsh";

    const lifeEditorDir = path.join(os.homedir(), "life-editor");
    const cwd = fs.existsSync(lifeEditorDir) ? lifeEditorDir : os.homedir();

    const ptyProcess = pty.spawn(shell, ["--login"], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
      } as Record<string, string>,
    });

    const claudeDetector = new ClaudeDetector();

    claudeDetector.onStateChange((state) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(
          "terminal:claudeStatus",
          sessionId,
          state,
        );
      }
    });

    const session: Session = {
      pty: ptyProcess,
      buffer: "",
      timer: null,
      claudeDetector,
    };

    ptyProcess.onData((data: string) => {
      session.claudeDetector.processOutput(data);
      session.buffer += data;
      if (!session.timer) {
        session.timer = setTimeout(() => {
          this.flush(sessionId);
        }, BATCH_INTERVAL_MS);
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      log.info(`[Terminal] Session ${sessionId} exited with code ${exitCode}`);
      this.sessions.delete(sessionId);
    });

    this.sessions.set(sessionId, session);
    log.info(`[Terminal] Created session ${sessionId}`);
    return sessionId;
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pty.write(data);
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pty.resize(cols, rows);
    }
  }

  destroy(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.timer) clearTimeout(session.timer);
      session.pty.kill();
      this.sessions.delete(sessionId);
      log.info(`[Terminal] Destroyed session ${sessionId}`);
    }
  }

  destroyAll(): void {
    for (const [id] of this.sessions) {
      this.destroy(id);
    }
  }

  private flush(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const data = session.buffer;
    session.buffer = "";
    session.timer = null;

    if (data && this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("terminal:data", sessionId, data);
    }
  }
}
