import type { DataService } from "./DataService";
import { tauriDataService } from "./TauriDataService";

let testOverride: DataService | null = null;

export function setDataServiceForTest(service: DataService): void {
  testOverride = service;
}

export function resetDataService(): void {
  testOverride = null;
}

export function getDataService(): DataService {
  return testOverride ?? tauriDataService;
}
