import type { DataService } from "./DataService";
import { ElectronDataService } from "./ElectronDataService";
import { RestDataService } from "./RestDataService";

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
    instance = isElectron() ? new ElectronDataService() : new RestDataService();
  }
  return instance;
}
