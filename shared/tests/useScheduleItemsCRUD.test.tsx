import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useState } from "react";
import { useScheduleItemsCRUD } from "../src/hooks/useScheduleItemsCRUD";
import type { ScheduleItemsMirrorAccess } from "../src/hooks/useScheduleItemsViewMirror";
import type { ScheduleItem } from "../src/types/schedule";
import type { UndoConfirmSpec } from "../src/utils/undoRedo/UndoRedoManager";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #1642 P1 — useScheduleItemsCRUD driven directly, pinned before phase 2
 * changes how its undo bodies fail (P4) and how its writes report (P5 / P6).
 * scheduleItemsCRUD.test.tsx reaches it through the composer; this suite pins
 * the rules each write carries about its OWN undo entry, and that every undo
 * and redo writes the host's on-screen store as well as the DB (#568).
 *
 * Not pinned on purpose, because phase 2 changes them: a failing undo body
 * (B-10), what a failed create leaves behind (N-07), and a dismiss of a row
 * it cannot find (K-03).
 */

const TODAY = "2026-09-26";
const REPEAT: UndoConfirmSpec = { kind: "repeat", scope: "this" };

const item = (id: string, over: Partial<ScheduleItem> = {}): ScheduleItem => ({
  id,
  date: TODAY,
  title: id,
  startTime: "09:00",
  endTime: "10:00",
  completed: false,
  completedAt: null,
  routineId: null,
  templateId: null,
  memo: null,
  noteId: null,
  content: null,
  isDeleted: false,
  deletedAt: null,
  isDismissed: false,
  isAllDay: false,
  createdAt: TODAY,
  updatedAt: TODAY,
  ...over,
});

interface Command {
  label: string;
  confirm?: UndoConfirmSpec;
  undo: () => void;
  redo: () => void;
}

function setup(rows: ScheduleItem[] = []) {
  const spies = {
    createScheduleItem: vi.fn(async (id: string, date: string, title: string) =>
      item(id, { date, title, updatedAt: "saved" }),
    ),
    updateScheduleItem: vi.fn(async (id: string) => item(id)),
    toggleScheduleItemComplete: vi.fn(async (id: string) => item(id)),
    softDeleteScheduleItem: vi.fn(async () => {}),
    restoreScheduleItem: vi.fn(async () => {}),
    dismissScheduleItem: vi.fn(async () => {}),
    undismissScheduleItem: vi.fn(async () => {}),
  };
  const makeDS = () => stubDataService(spies);
  const commands: Command[] = [];
  const push = vi.fn((_domain: string, command: Command) => {
    commands.push(command);
  });
  const mirror = {
    registerViewMirror: vi.fn(() => () => {}),
    findItem: (id: string) => rows.find((r) => r.id === id),
    upsert: vi.fn(),
    patch: vi.fn(),
    remove: vi.fn(),
    restore: vi.fn(),
  } satisfies ScheduleItemsMirrorAccess;
  const ds = makeDS();
  const view = renderHook(() => {
    const [items, setItems] = useState(rows);
    const [deleted, setDeletedItems] = useState<ScheduleItem[]>([]);
    const api = useScheduleItemsCRUD({
      ds,
      push,
      date: TODAY,
      dateRef: { current: TODAY },
      setItems,
      setDeletedItems,
      mirror,
    });
    return { api, items, deleted };
  });
  return {
    ...spies,
    push,
    commands,
    mirror,
    api: () => view.result.current.api,
    ids: () => view.result.current.items.map((i) => i.id),
    items: () => view.result.current.items,
    deleted: () => view.result.current.deleted,
  };
}

describe("useScheduleItemsCRUD — create", () => {
  it("shows the row at once and records the entry only once it lands", async () => {
    const h = setup();
    const onSaved = vi.fn();
    let id = "";

    act(() => {
      id = h
        .api()
        .createScheduleItem(TODAY, "Lunch", "12:00", "13:00", {
          reminderOffset: null,
          onSaved,
        });
    });
    expect(h.ids()).toEqual([id]);
    expect(h.push).not.toHaveBeenCalled();

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onSaved.mock.calls[0][0]).toMatchObject({ id, title: "Lunch" });
    expect(h.commands.map((c) => c.label)).toEqual(["createScheduleItem"]);
  });

  it("undoes by trashing the row, and redoes with the SAVED row", async () => {
    const h = setup();
    let id = "";
    act(() => {
      id = h
        .api()
        .createScheduleItem(TODAY, "Lunch", "12:00", "13:00", {
          reminderOffset: null,
        });
    });
    await waitFor(() => expect(h.commands).toHaveLength(1));

    act(() => h.commands[0].undo());
    expect(h.ids()).toEqual([]);
    expect(h.mirror.remove).toHaveBeenCalledWith(id);
    expect(h.softDeleteScheduleItem).toHaveBeenCalledWith(id);

    act(() => h.commands[0].redo());
    expect(h.restoreScheduleItem).toHaveBeenCalledWith(id);
    // What the server returned, not the optimistic guess.
    expect(h.mirror.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id, updatedAt: "saved" }),
    );
    expect(h.ids()).toEqual([id]);
  });
});

describe("useScheduleItemsCRUD — update", () => {
  it("records the previous values of exactly the fields it changed", () => {
    const h = setup([item("s-1", { title: "Old", memo: "keep" })]);

    act(() => h.api().updateScheduleItem("s-1", { title: "New" }));
    expect(h.items()[0].title).toBe("New");
    const [command] = h.commands;
    expect(command.label).toBe("updateScheduleItem");

    act(() => command.undo());
    expect(h.updateScheduleItem).toHaveBeenLastCalledWith("s-1", {
      title: "Old",
    });
    expect(h.mirror.patch).toHaveBeenLastCalledWith("s-1", { title: "Old" });
    expect(h.items()[0].title).toBe("Old");

    act(() => command.redo());
    expect(h.updateScheduleItem).toHaveBeenLastCalledWith("s-1", {
      title: "New",
    });
    expect(h.mirror.patch).toHaveBeenLastCalledWith("s-1", { title: "New" });
  });

  it("asks before undoing an edit to a repeat's occurrence, and only then", () => {
    const h = setup([item("s-1"), item("s-2", { routineId: "routine-1" })]);

    act(() => h.api().updateScheduleItem("s-1", { title: "a" }));
    act(() => h.api().updateScheduleItem("s-2", { title: "b" }));

    expect(h.commands.map((c) => c.confirm)).toEqual([undefined, REPEAT]);

    // `skipUndo`, or a row it cannot find: the write lands, nothing is recorded.
    act(() => h.api().updateScheduleItem("s-1", { title: "c" }, { skipUndo: true }));
    act(() => h.api().updateScheduleItem("ghost", { title: "d" }));
    expect(h.updateScheduleItem).toHaveBeenCalledTimes(4);
    expect(h.commands).toHaveLength(2);
  });

});

describe("useScheduleItemsCRUD — complete toggle, skip, delete", () => {
  it("undoes a toggle by SETTING the recorded value, not by flipping again (B-09)", () => {
    const h = setup([item("s-1")]);

    act(() => h.api().toggleComplete("s-1"));
    act(() => h.commands[0].undo());

    const restored = { completed: false, completedAt: null };
    expect(h.updateScheduleItem).toHaveBeenCalledWith("s-1", restored);
    expect(h.mirror.patch).toHaveBeenCalledWith("s-1", restored);
    expect(h.toggleScheduleItemComplete).toHaveBeenCalledTimes(1);

    act(() => h.commands[0].redo());
    expect(h.toggleScheduleItemComplete).toHaveBeenCalledTimes(2);
  });

  it("puts a skipped row's snapshot back on the grid on undo, and takes it off on redo", () => {
    const row = item("s-1", { routineId: "routine-1" });
    const h = setup([row]);

    act(() => h.api().dismiss("s-1"));
    expect(h.items()[0].isDismissed).toBe(true);
    const [command] = h.commands;
    expect([command.label, command.confirm]).toEqual([
      "dismissScheduleItem",
      REPEAT,
    ]);

    act(() => command.undo());
    expect(h.mirror.restore).toHaveBeenCalledWith("s-1", row, {
      isDismissed: false,
    });
    expect(h.undismissScheduleItem).toHaveBeenCalledWith("s-1");

    act(() => command.redo());
    expect(h.mirror.remove).toHaveBeenCalledWith("s-1");
    expect(h.dismissScheduleItem).toHaveBeenCalledTimes(2);
  });

  it("moves a deleted row to the trash list and brings it back on undo", () => {
    const row = item("s-1", { routineId: "routine-1" });
    const h = setup([row]);

    act(() => h.api().deleteScheduleItem("s-1"));
    expect(h.ids()).toEqual([]);
    expect(h.deleted().map((d) => [d.id, d.isDeleted])).toEqual([
      ["s-1", true],
    ]);
    const [command] = h.commands;
    expect([command.label, command.confirm]).toEqual([
      "deleteScheduleItem",
      REPEAT,
    ]);

    act(() => command.undo());
    expect(h.ids()).toEqual(["s-1"]);
    expect(h.deleted()).toEqual([]);
    expect(h.mirror.upsert).toHaveBeenCalledWith({
      ...row,
      isDeleted: false,
      deletedAt: null,
    });
    expect(h.restoreScheduleItem).toHaveBeenCalledWith("s-1");

    act(() => command.redo());
    expect(h.mirror.remove).toHaveBeenCalledWith("s-1");
    expect(h.softDeleteScheduleItem).toHaveBeenCalledTimes(2);
  });

});
