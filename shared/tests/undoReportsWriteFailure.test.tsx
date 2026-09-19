import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import {
  useTodoTreeHistory,
  createNoopUndoRedo,
  type UndoRedoLike,
} from "../src/hooks/useTodoTreeHistory";
import { useDailiesUnifiedAPI } from "../src/hooks/useDailiesUnifiedAPI";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import { stubDataService } from "./helpers/dataServiceStub";
import type { UndoCommand } from "../src/utils/undoRedo/UndoRedoManager";
import type { TodoNode } from "../src/types/todoTree";
import type { DailyNode } from "../src/types/daily";

/*
 * #1682 — a reversal the DB refused must READ as refused.
 *
 * Every closure below used to end its write in `.catch(logServiceError)`, so
 * the manager saw a clean return and the host toasted "Undid: …" over a row
 * that had not moved. One reload later the change was back, with the undo
 * already spent.
 *
 * One case per domain, all the same shape: make the DataService reject, run
 * the pushed closure, and require the promise to carry the failure out. The
 * note domain's pair lives in notesUnifiedCRUD.test.ts (it has the harness),
 * and the briefing pair in web/tests/briefingUndoFailure.test.ts.
 */

function collector() {
  const commands: UndoCommand[] = [];
  const undoRedo: UndoRedoLike = {
    ...createNoopUndoRedo(),
    push: (_domain, command) => {
      commands.push(command);
    },
  };
  return { commands, undoRedo };
}

function todo(id: string): TodoNode {
  return {
    id,
    type: "task",
    title: id,
    parentId: null,
    order: 0,
    status: "NOT_STARTED",
    createdAt: "2026-09-19T00:00:00.000Z",
  };
}

describe("todoTree — the tree sync's failure reaches the manager", () => {
  it("rejects the undo when the write back fails", async () => {
    const { commands, undoRedo } = collector();
    const syncToDb = vi
      .fn<
        (nodes: TodoNode[], onSettled?: (ok: boolean) => void) => Promise<void>
      >()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() =>
      useTodoTreeHistory(
        vi.fn(),
        syncToDb,
        undoRedo,
        vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
      ),
    );

    act(() => result.current.persistWithHistory([], [todo("a")]));

    await expect(commands[0]?.undo()).rejects.toThrow("offline");
  });
});

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    SyncContext.Provider,
    {
      value: {
        syncVersion: 0,
        domainVersions: uniformDomainVersions(0),
        triggerSync: async () => {},
      },
    },
    children,
  );
}

const SAVED: DailyNode = {
  id: "daily-2026-09-19",
  date: "2026-09-19",
  content: "hello",
  createdAt: "2026-09-19T00:00:00.000Z",
  updatedAt: "2026-09-19T00:00:00.000Z",
};

describe("daily — the delete's failure reaches the manager", () => {
  it("rejects the undo of a create when the soft delete fails", async () => {
    const { commands, undoRedo } = collector();
    const ds = stubDataService({
      listDailiesUnified: () => Promise.resolve([]),
      upsertDailyByDateUnified: () => Promise.resolve(SAVED),
      // The undo resolves the date to a row first, then deletes it.
      getDailyByDateUnified: () => Promise.resolve(SAVED),
      softDeleteDailyUnified: () => Promise.reject(new Error("offline")),
    });
    const { result } = renderHook(
      () => useDailiesUnifiedAPI({ dataService: ds, undoRedo }),
      { wrapper },
    );

    await act(async () => {
      await result.current.upsertDaily("2026-09-19", "hello");
    });

    await expect(commands[0]?.undo()).rejects.toThrow("offline");
  });
});
