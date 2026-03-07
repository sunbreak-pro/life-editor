export type ClaudeState =
  | "inactive"
  | "idle"
  | "thinking"
  | "generating"
  | "tool_use"
  | "error";

type StateChangeCallback = (state: ClaudeState) => void;

const DEBOUNCE_MS = 100;
const BUFFER_MAX_LINES = 20;

const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?(\x07|\x1b\\)/g;

const CLAUDE_LAUNCH_REGEX = /(?:^|\n)\s*[$>]\s+claude\b/;
const BARE_PROMPT_REGEX = /(?:^|\n)\s*[$>]\s*$/;

const ERROR_PATTERNS = [/error/i, /failed/i, /exception/i];
const TOOL_USE_PATTERNS = [
  /\btool\b/i,
  /\bread\b.*file/i,
  /\bwrite\b.*file/i,
  /\bedit\b/i,
  /\bbash\b/i,
  /\bgrep\b/i,
  /\bglob\b/i,
];
const THINKING_PATTERNS = [/thinking/i, /\.\.\.\s*$/];
const GENERATING_PATTERNS = [/generating/i, /writing/i];

export class ClaudeDetector {
  private state: ClaudeState = "inactive";
  private isClaudeActive = false;
  private listeners: Set<StateChangeCallback> = new Set();
  private lineBuffer: string[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingState: ClaudeState | null = null;

  processOutput(data: string): void {
    const clean = stripAnsi(data);
    const lines = clean.split("\n");

    for (const line of lines) {
      if (line.length > 0) {
        this.lineBuffer.push(line);
      }
    }
    if (this.lineBuffer.length > BUFFER_MAX_LINES) {
      this.lineBuffer = this.lineBuffer.slice(-BUFFER_MAX_LINES);
    }

    const buffered = this.lineBuffer.join("\n");

    if (!this.isClaudeActive) {
      if (CLAUDE_LAUNCH_REGEX.test(buffered)) {
        this.isClaudeActive = true;
        this.setState("idle");
      }
      return;
    }

    if (BARE_PROMPT_REGEX.test(clean)) {
      this.isClaudeActive = false;
      this.setState("inactive");
      return;
    }

    const recentText = this.lineBuffer.slice(-5).join("\n");
    const newState = this.detectState(recentText);
    if (newState !== this.state) {
      this.setState(newState);
    }
  }

  getState(): ClaudeState {
    return this.state;
  }

  onStateChange(callback: StateChangeCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private detectState(text: string): ClaudeState {
    if (ERROR_PATTERNS.some((p) => p.test(text))) return "error";
    if (TOOL_USE_PATTERNS.some((p) => p.test(text))) return "tool_use";
    if (THINKING_PATTERNS.some((p) => p.test(text))) return "thinking";
    if (GENERATING_PATTERNS.some((p) => p.test(text))) return "generating";
    return "idle";
  }

  private setState(newState: ClaudeState): void {
    this.pendingState = newState;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      if (this.pendingState !== null && this.pendingState !== this.state) {
        this.state = this.pendingState;
        for (const cb of this.listeners) {
          cb(this.state);
        }
      }
      this.pendingState = null;
      this.debounceTimer = null;
    }, DEBOUNCE_MS);
  }
}

function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, "");
}
