import { createContext } from "react";
import type { SyncResult, SyncStatus } from "../types/sync";

export interface SyncError {
  message: string;
  at: number;
}

export interface SyncContextValue {
  status: SyncStatus | null;
  lastSyncResult: SyncResult | null;
  lastError: SyncError | null;
  isSyncing: boolean;
  syncVersion: number;
  triggerSync: () => Promise<void>;
  configure: (url: string, token: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  fullDownload: () => Promise<void>;
  clearError: () => void;
}

export const SyncContext = createContext<SyncContextValue | null>(null);
