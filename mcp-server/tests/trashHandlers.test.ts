import { describe, it, expect, vi } from "vitest";
import { createSupabaseStub, type SupabaseStub } from "./supabaseStub.js";

let stub: SupabaseStub = createSupabaseStub();
vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
}));

// Dynamic on purpose: a static import would be hoisted above vi.mock and read
// the real supabase module before the stub exists.
const { restoreItem } = await import("../src/handlers/trashHandlers.js");

/*
 * restore_item (#782 ①) — the way back out of the trash.
 *
 * The three delete tools only set items_meta.is_deleted, so before this tool
 * an MCP caller who trashed the wrong item had to open the app. What is
 * pinned here is mostly what it does NOT do: an item that is already live is
 * answered without a write, because a "restore" that bumps updated_at for
 * nothing moves the LWW cursor and makes every other device refetch.
 */

const metaRow = (over: Record<string, unknown> = {}) => ({
  id: "task-1",
  role: "task",
  title: "write the thing",
  is_deleted: true,
  ...over,
});

describe("restoreItem", () => {
  it("clears the trash flags and bumps updated_at", async () => {
    stub = createSupabaseStub(() => metaRow());

    const result = await restoreItem({ id: "task-1" });

    expect(result).toEqual({
      id: "task-1",
      role: "task",
      title: "write the thing",
      restored: true,
    });

    const writes = stub.writes();
    expect(writes).toHaveLength(1);
    expect(writes[0].table).toBe("items_meta");
    expect(writes[0].op).toBe("update");
    expect(writes[0].values).toMatchObject({
      is_deleted: false,
      deleted_at: null,
    });
    expect(writes[0].values).toHaveProperty("updated_at"); // §10.2 LWW bump
    expect(writes[0].filters).toEqual({ id: "task-1", role: "task" });
  });

  it("restores a trashed schedule item under its 'event' role", async () => {
    stub = createSupabaseStub(() => metaRow({ id: "si-1", role: "event" }));

    const result = await restoreItem({ id: "si-1" });

    expect(result).toMatchObject({ role: "event", restored: true });
    expect(stub.writes()[0].filters).toEqual({ id: "si-1", role: "event" });
  });

  it("writes nothing for an item that is already live", async () => {
    stub = createSupabaseStub(() =>
      metaRow({ id: "note-1", role: "note", title: "N", is_deleted: false }),
    );

    const result = await restoreItem({ id: "note-1" });

    expect(result).toEqual({
      id: "note-1",
      role: "note",
      title: "N",
      restored: false,
      alreadyLive: true,
    });
    expect(stub.writes()).toEqual([]);
  });

  it("reads the trashed row too (not just the live ones)", async () => {
    stub = createSupabaseStub(() => metaRow());

    await restoreItem({ id: "task-1" });

    // A `.eq('is_deleted', false)` here would find nothing to restore, ever.
    expect(stub.calls[0].filters).toEqual({ id: "task-1" });
  });

  it("throws when no item carries the id", async () => {
    stub = createSupabaseStub(() => null);

    await expect(restoreItem({ id: "ghost" })).rejects.toThrow(
      "Item not found: ghost",
    );
    expect(stub.writes()).toEqual([]);
  });

  it("refuses a role it cannot restore, naming the role it found", async () => {
    stub = createSupabaseStub(() =>
      metaRow({ id: "daily-2026-08-12", role: "daily" }),
    );

    await expect(restoreItem({ id: "daily-2026-08-12" })).rejects.toThrow(
      /restore_item supports tasks, notes and schedule items; daily-2026-08-12 is a "daily"/,
    );
    expect(stub.writes()).toEqual([]);
  });
});
