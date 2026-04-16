import { createContext } from "react";
import type { SyncResult, SyncStatus } from "../types/sync";

export interface SyncContextValue {
  status: SyncStatus | null;
  lastSyncResult: SyncResult | null;
  isSyncing: boolean;
  triggerSync: () => Promise<void>;
  configure: (url: string, token: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  fullDownload: () => Promise<void>;
}

export const SyncContext = createContext<SyncContextValue | null>(null);
