import type { DataService } from "./DataService";
import { TauriDataService } from "./TauriDataService";

let instance: DataService | null = null;
let testOverride: DataService | null = null;

export function setDataServiceForTest(service: DataService): void {
  testOverride = service;
}

export function resetDataService(): void {
  testOverride = null;
}

export function getDataService(): DataService {
  if (testOverride) return testOverride;
  if (!instance) {
    instance = new TauriDataService();
  }
  return instance;
}
