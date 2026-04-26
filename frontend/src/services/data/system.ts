import type { BrowserInfo, InstalledApp } from "../../types/sidebarLink";
import { tauriInvoke } from "../bridge";

export const systemApi = {
  getAppSetting(key: string): Promise<string | null> {
    return tauriInvoke("settings_get", { key });
  },
  setAppSetting(key: string, value: string): Promise<void> {
    return tauriInvoke("settings_set", { key, value });
  },
  getAllAppSettings(): Promise<Record<string, string>> {
    return tauriInvoke("settings_get_all");
  },
  removeAppSetting(key: string): Promise<void> {
    return tauriInvoke("settings_remove", { key });
  },
  getAutoLaunch(): Promise<boolean> {
    return tauriInvoke("system_get_auto_launch");
  },
  setAutoLaunch(enabled: boolean): Promise<void> {
    return tauriInvoke("system_set_auto_launch", { enabled });
  },
  getStartMinimized(): Promise<boolean> {
    return tauriInvoke("system_get_start_minimized");
  },
  setStartMinimized(enabled: boolean): Promise<void> {
    return tauriInvoke("system_set_start_minimized", { enabled });
  },
  getTrayEnabled(): Promise<boolean> {
    return tauriInvoke("system_get_tray_enabled");
  },
  setTrayEnabled(enabled: boolean): Promise<void> {
    return tauriInvoke("system_set_tray_enabled", { enabled });
  },
  getGlobalShortcuts(): Promise<Record<string, string>> {
    return tauriInvoke("system_get_global_shortcuts");
  },
  setGlobalShortcuts(shortcuts: Record<string, string>): Promise<void> {
    return tauriInvoke("system_set_global_shortcuts", { shortcuts });
  },
  reregisterGlobalShortcuts(): Promise<{ success: boolean }> {
    return tauriInvoke("system_reregister_global_shortcuts");
  },
  updateTrayTimer(state: {
    remaining: string;
    isRunning: boolean;
  }): Promise<void> {
    return tauriInvoke("tray_update_timer", { state });
  },
  listBrowsers(): Promise<BrowserInfo[]> {
    return tauriInvoke("system_list_browsers");
  },
  listApplications(): Promise<InstalledApp[]> {
    return tauriInvoke("system_list_applications");
  },
  systemOpenUrl(url: string, browserId?: string | null): Promise<void> {
    return tauriInvoke("system_open_url", {
      url,
      browserId: browserId ?? null,
    });
  },
  systemOpenApp(appPath: string): Promise<void> {
    return tauriInvoke("system_open_app", { appPath });
  },
  getReminderSettings(): Promise<Record<string, string>> {
    return tauriInvoke("reminder_get_settings");
  },
  setReminderSettings(settings: Record<string, string>): Promise<void> {
    return tauriInvoke("reminder_set_settings", { settings });
  },
};
