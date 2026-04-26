import type { AttachmentMeta } from "../../types/attachment";
import type {
  IpcChannelMetrics,
  LogEntry,
  SystemInfo,
} from "../../types/diagnostics";
import { tauriInvoke } from "../bridge";

export const miscApi = {
  exportData(): Promise<boolean> {
    return tauriInvoke("data_export");
  },
  importData(): Promise<boolean> {
    return tauriInvoke("data_import");
  },
  resetData(): Promise<boolean> {
    return tauriInvoke("data_reset");
  },
  fetchLogs(options?: { level?: string; limit?: number }): Promise<LogEntry[]> {
    return tauriInvoke("diagnostics_fetch_logs", { options });
  },
  openLogFolder(): Promise<void> {
    return tauriInvoke("diagnostics_open_log_folder");
  },
  exportLogs(): Promise<boolean> {
    return tauriInvoke("diagnostics_export_logs");
  },
  fetchMetrics(): Promise<IpcChannelMetrics[]> {
    return tauriInvoke("diagnostics_fetch_metrics");
  },
  resetMetrics(): Promise<boolean> {
    return tauriInvoke("diagnostics_reset_metrics");
  },
  fetchSystemInfo(): Promise<SystemInfo> {
    return tauriInvoke("diagnostics_fetch_system_info");
  },
  openExternal(url: string): Promise<void> {
    return tauriInvoke("shell_open_external", { url });
  },
  openAttachmentFile(id: string): Promise<void> {
    return tauriInvoke("shell_open_path", { id });
  },
  async saveAttachment(meta: AttachmentMeta, data: ArrayBuffer): Promise<void> {
    await tauriInvoke("attachment_save", {
      meta,
      data: Array.from(new Uint8Array(data)),
    });
  },
  loadAttachment(id: string): Promise<ArrayBuffer | null> {
    return tauriInvoke("attachment_load", { id });
  },
  deleteAttachment(id: string): Promise<void> {
    return tauriInvoke("attachment_delete", { id });
  },
  fetchAttachmentMetas(): Promise<AttachmentMeta[]> {
    return tauriInvoke("attachment_fetch_metas");
  },
  checkForUpdates(): Promise<void> {
    return tauriInvoke("updater_check_for_updates");
  },
  downloadUpdate(): Promise<void> {
    return tauriInvoke("updater_download_update");
  },
  installUpdate(): Promise<void> {
    return tauriInvoke("updater_install_update");
  },
};
