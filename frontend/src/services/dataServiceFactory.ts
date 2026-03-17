import type { DataService } from "./DataService";
import { ElectronDataService } from "./ElectronDataService";
import { OfflineDataService } from "./OfflineDataService";

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

export function getDataService(): DataService {
  if (testOverride) return testOverride;
  if (!instance) {
    instance = isElectron()
      ? new ElectronDataService()
      : new OfflineDataService();
  }
  return instance;
}

export function getOfflineDataService(): OfflineDataService | null {
  const svc = getDataService();
  return svc instanceof OfflineDataService ? svc : null;
}
