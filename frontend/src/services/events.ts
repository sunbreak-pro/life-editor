import type { UpdaterStatus } from "../types/updater";

export type UnlistenFn = () => void;

let tauriEvent: typeof import("@tauri-apps/api/event") | null = null;

async function getTauriEvent(): Promise<
  typeof import("@tauri-apps/api/event")
> {
  if (!tauriEvent) {
    tauriEvent = await import("@tauri-apps/api/event");
  }
  return tauriEvent;
}

export async function onMenuAction(
  callback: (action: string) => void,
): Promise<UnlistenFn> {
  const { listen } = await getTauriEvent();
  return listen<string>("menu_action", (event) => callback(event.payload));
}

export async function onUpdaterStatus(
  callback: (status: UpdaterStatus) => void,
): Promise<UnlistenFn> {
  const { listen } = await getTauriEvent();
  return listen<UpdaterStatus>("updater_status", (event) =>
    callback(event.payload),
  );
}

export async function onTerminalData(
  callback: (sessionId: string, data: string) => void,
): Promise<UnlistenFn> {
  const { listen } = await getTauriEvent();
  return listen<{ sessionId: string; data: string }>("terminal_data", (event) =>
    callback(event.payload.sessionId, event.payload.data),
  );
}

export async function onClaudeStatus(
  callback: (sessionId: string, state: string) => void,
): Promise<UnlistenFn> {
  const { listen } = await getTauriEvent();
  return listen<{ sessionId: string; state: string }>(
    "terminal_claude_status",
    (event) => callback(event.payload.sessionId, event.payload.state),
  );
}

export async function onReminder(
  callback: (data: { id: string; title: string; type: string }) => void,
): Promise<UnlistenFn> {
  const { listen } = await getTauriEvent();
  return listen<{ id: string; title: string; type: string }>(
    "reminder_notify",
    (event) => callback(event.payload),
  );
}

export async function onFileChange(
  callback: (changes: Array<{ path: string; type: string }>) => void,
): Promise<UnlistenFn> {
  const { listen } = await getTauriEvent();
  return listen<Array<{ path: string; type: string }>>(
    "files_changed",
    (event) => callback(event.payload),
  );
}

export async function emitSyncComplete(): Promise<void> {
  const { emit } = await getTauriEvent();
  emit("sync_complete", {});
}

export async function onSyncComplete(
  callback: () => void,
): Promise<UnlistenFn> {
  const { listen } = await getTauriEvent();
  return listen("sync_complete", () => callback());
}
