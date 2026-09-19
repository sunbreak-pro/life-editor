import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import {
  ToastProvider,
  todayDateKey,
  useUndoRedoContext,
  type TodoNode,
} from "@life-editor/shared";
import { stubDataService } from "./helpers";
import { UndoRedoHost } from "../src/UndoRedoHost";
import { useBriefingWrites } from "../src/briefing/hooks/useBriefingWrites";

/*
 * #1682 — the paper's deletes report their reversal honestly.
 *
 * Briefing writes through the DataService directly (it mounts none of the
 * domain providers), so its undo closures were their own copies of the
 * swallow: `void ds.restoreTodo(id).catch(console.error)`. The manager saw a
 * clean return and the host said "Undid: todo deletion" over a todo that was
 * still deleted on the server.
 *
 * Driven through the real UndoRedoHost rather than a captured command,
 * because the copy the user reads is the thing that was wrong.
 */

const TODAY = todayDateKey();

const TODO: TodoNode = {
  id: "t1",
  type: "task",
  title: "Write report",
  status: "NOT_STARTED",
  scheduledAt: `${TODAY}T00:00:00`,
  isAllDay: true,
  parentId: null,
  order: 0,
  createdAt: "2026-09-19T00:00:00.000Z",
  updatedAt: "2026-09-19T00:00:00.000Z",
};

function Probe({ restoreFails }: { restoreFails: boolean }) {
  const [todoNodes, setTodoNodes] = useState<TodoNode[]>([TODO]);
  const { undo } = useUndoRedoContext();
  const ds = useState(() =>
    stubDataService({
      softDeleteTodo: vi.fn().mockResolvedValue(undefined),
      restoreTodo: restoreFails
        ? vi.fn().mockRejectedValue(new Error("offline"))
        : vi.fn().mockResolvedValue(undefined),
    }),
  )[0];
  const { handleDeleteTodo } = useBriefingWrites({
    ds,
    todayKey: TODAY,
    scheduleItems: [],
    setScheduleItems: () => {},
    todoNodes,
    setTodoNodes,
    setConnections: () => {},
  });
  return (
    <>
      <button type="button" onClick={() => handleDeleteTodo("t1")}>
        delete
      </button>
      <button type="button" onClick={() => undo()}>
        undo
      </button>
    </>
  );
}

async function deleteThenUndo(restoreFails: boolean): Promise<void> {
  render(
    <ToastProvider>
      <UndoRedoHost>
        <Probe restoreFails={restoreFails} />
      </UndoRedoHost>
    </ToastProvider>,
  );
  await act(async () => fireEvent.click(screen.getByText("delete")));
  await act(async () => fireEvent.click(screen.getByText("undo")));
}

describe("briefing deletes (#1682)", () => {
  it("says it could not undo when the restore is refused", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await deleteThenUndo(true);
    spy.mockRestore();

    screen.getByText("Couldn't undo: todo deletion");
    expect(screen.queryByText("Undid: todo deletion")).toBeNull();
  });

  it("still says it undid one that landed", async () => {
    await deleteThenUndo(false);

    screen.getByText("Undid: todo deletion");
    expect(screen.queryByText("Couldn't undo: todo deletion")).toBeNull();
  });
});
