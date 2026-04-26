import type { SyncResult, SyncStatus } from "../../types/sync";
import { tauriInvoke } from "../bridge";

export const syncApi = {
  syncConfigure(url: string, token: string): Promise<boolean> {
    return tauriInvoke("sync_configure", { url, token });
  },
  syncTrigger(): Promise<SyncResult> {
    return tauriInvoke("sync_trigger");
  },
  syncGetStatus(): Promise<SyncStatus> {
    return tauriInvoke("sync_get_status");
  },
  syncDisconnect(): Promise<void> {
    return tauriInvoke("sync_disconnect");
  },
  syncFullDownload(): Promise<SyncResult> {
    return tauriInvoke("sync_full_download");
  },
};
