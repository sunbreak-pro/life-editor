import type { DataService } from "./DataService";
import { ElectronDataService } from "./ElectronDataService";
import { OfflineDataService } from "./OfflineDataService";
import { StandaloneDataService } from "./StandaloneDataService";
import { TauriDataService } from "./TauriDataService";
import { isTauri } from "./bridge";

let instance: DataService | null = null;
let testOverride: DataService | null = null;

export function setDataServiceForTest(service: DataService): void {
  testOverride = service;
}

export function resetDataService(): void {
  testOverride = null;
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI;
}

export function isStandalone(): boolean {
  // Capacitor native platform or explicit standalone flag
  try {
    // Dynamic import check — @capacitor/core sets this on native platforms
    return (
      typeof window !== "undefined" &&
      !!(window as Record<string, unknown>).Capacitor &&
      !!(
        (window as Record<string, unknown>).Capacitor as Record<string, unknown>
      ).isNativePlatform
    );
  } catch {
    return false;
  }
}

export function getDataService(): DataService {
  if (testOverride) return testOverride;
  if (!instance) {
    if (isTauri()) {
      instance = new TauriDataService();
    } else if (isElectron()) {
      instance = new ElectronDataService();
    } else if (isStandalone()) {
      instance = new StandaloneDataService();
    } else {
      instance = new OfflineDataService();
    }
  }
  return instance;
}

export function getOfflineDataService(): OfflineDataService | null {
  const svc = getDataService();
  return svc instanceof OfflineDataService ? svc : null;
}

export function getStandaloneDataService(): StandaloneDataService | null {
  const svc = getDataService();
  return svc instanceof StandaloneDataService ? svc : null;
}

export function getTauriDataService(): TauriDataService | null {
  const svc = getDataService();
  return svc instanceof TauriDataService ? svc : null;
}
