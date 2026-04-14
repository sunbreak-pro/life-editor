import { ElectronDataService } from "./ElectronDataService";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const mockInvoke = vi.fn();

beforeEach(() => {
  mockInvoke.mockReset();
  Object.defineProperty(window, "electronAPI", {
    value: { invoke: mockInvoke },
    writable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, "electronAPI", {
    value: undefined,
    writable: true,
  });
});

describe("ElectronDataService", () => {
  let service: ElectronDataService;

  beforeEach(() => {
    service = new ElectronDataService();
  });

  // Tasks
  it("fetchTaskTree calls correct channel", async () => {
    mockInvoke.mockResolvedValue([]);
    await service.fetchTaskTree();
    expect(mockInvoke).toHaveBeenCalledWith("db:tasks:fetchTree");
  });

  it("createTask calls correct channel", async () => {
    const node = {
      id: "task-1",
      type: "task",
      title: "Test",
      parentId: null,
      order: 0,
      createdAt: "",
    };
    mockInvoke.mockResolvedValue(node);
    await service.createTask(node as never);
    expect(mockInvoke).toHaveBeenCalledWith("db:tasks:create", node);
  });

  it("updateTask calls correct channel with id and updates", async () => {
    mockInvoke.mockResolvedValue({});
    await service.updateTask("task-1", { title: "Updated" });
    expect(mockInvoke).toHaveBeenCalledWith("db:tasks:update", "task-1", {
      title: "Updated",
    });
  });

  it("softDeleteTask calls correct channel", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await service.softDeleteTask("task-1");
    expect(mockInvoke).toHaveBeenCalledWith("db:tasks:softDelete", "task-1");
  });

  // Timer
  it("fetchTimerSettings calls correct channel", async () => {
    mockInvoke.mockResolvedValue({});
    await service.fetchTimerSettings();
    expect(mockInvoke).toHaveBeenCalledWith("db:timer:fetchSettings");
  });

  it("startTimerSession passes sessionType and taskId", async () => {
    mockInvoke.mockResolvedValue({ id: 1 });
    await service.startTimerSession("WORK", "task-1");
    expect(mockInvoke).toHaveBeenCalledWith(
      "db:timer:startSession",
      "WORK",
      "task-1",
    );
  });

  it("startTimerSession passes null when no taskId", async () => {
    mockInvoke.mockResolvedValue({ id: 1 });
    await service.startTimerSession("BREAK");
    expect(mockInvoke).toHaveBeenCalledWith(
      "db:timer:startSession",
      "BREAK",
      null,
    );
  });

  // Sound
  it("fetchSoundSettings calls correct channel", async () => {
    mockInvoke.mockResolvedValue([]);
    await service.fetchSoundSettings();
    expect(mockInvoke).toHaveBeenCalledWith("db:sound:fetchSettings");
  });

  // Notes
  it("createNote calls correct channel", async () => {
    mockInvoke.mockResolvedValue({});
    await service.createNote("note-1", "Title");
    expect(mockInvoke).toHaveBeenCalledWith(
      "db:notes:create",
      "note-1",
      "Title",
      null,
    );
  });

  // Data I/O
  it("exportData calls correct channel", async () => {
    mockInvoke.mockResolvedValue(true);
    await service.exportData();
    expect(mockInvoke).toHaveBeenCalledWith("data:export");
  });
});
