import { tauriInvoke } from "./bridge";

export async function terminalCreate(): Promise<string> {
  return tauriInvoke<string>("terminal_create", {});
}

export async function terminalWrite(
  sessionId: string,
  data: string,
): Promise<void> {
  return tauriInvoke("terminal_write", { sessionId, data });
}

export async function terminalResize(
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> {
  return tauriInvoke("terminal_resize", { sessionId, cols, rows });
}

export async function terminalDestroy(sessionId: string): Promise<void> {
  return tauriInvoke("terminal_destroy", { sessionId });
}

export async function terminalClaudeState(sessionId: string): Promise<string> {
  return tauriInvoke<string>("terminal_claude_state", { sessionId });
}
