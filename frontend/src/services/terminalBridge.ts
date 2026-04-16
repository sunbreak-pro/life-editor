import { isTauri, tauriInvoke } from "./bridge";

export async function terminalCreate(): Promise<string> {
  if (isTauri()) {
    return tauriInvoke<string>("terminal_create", {});
  }
  return window.electronAPI!.invoke<string>("terminal:create");
}

export async function terminalWrite(
  sessionId: string,
  data: string,
): Promise<void> {
  if (isTauri()) {
    return tauriInvoke("terminal_write", { sessionId, data });
  }
  window.electronAPI?.invoke("terminal:write", sessionId, data);
}

export async function terminalResize(
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> {
  if (isTauri()) {
    return tauriInvoke("terminal_resize", { sessionId, cols, rows });
  }
  window.electronAPI?.invoke("terminal:resize", sessionId, cols, rows);
}

export async function terminalDestroy(sessionId: string): Promise<void> {
  if (isTauri()) {
    return tauriInvoke("terminal_destroy", { sessionId });
  }
  window.electronAPI?.invoke("terminal:destroy", sessionId);
}

export async function terminalClaudeState(sessionId: string): Promise<string> {
  if (isTauri()) {
    return tauriInvoke<string>("terminal_claude_state", { sessionId });
  }
  return (
    (await window.electronAPI?.invoke<string>(
      "terminal:claudeState",
      sessionId,
    )) ?? "inactive"
  );
}
