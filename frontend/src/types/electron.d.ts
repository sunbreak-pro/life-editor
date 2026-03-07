import type { UpdaterStatus } from "./updater";

export interface ElectronAPI {
  platform: string;
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>;
  onMenuAction(callback: (action: string) => void): () => void;
  onUpdaterStatus(callback: (status: UpdaterStatus) => void): () => void;
  onTerminalData(
    callback: (sessionId: string, data: string) => void,
  ): () => void;
  onClaudeStatus(
    callback: (sessionId: string, state: string) => void,
  ): () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
