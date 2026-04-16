/// <reference types="vitest/globals" />
import "@testing-library/jest-dom/vitest";
import { resetDataService } from "../services/dataServiceFactory";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock Notification API
const NotificationMock = vi.fn().mockImplementation(() => ({
  close: vi.fn(),
})) as unknown as typeof Notification;
Object.defineProperty(NotificationMock, "permission", {
  value: "denied",
  writable: true,
});
Object.defineProperty(NotificationMock, "requestPermission", {
  value: vi.fn().mockResolvedValue("denied"),
});
Object.defineProperty(window, "Notification", {
  value: NotificationMock,
  writable: true,
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  resetDataService();
});
