import { describe, it, expect } from "vitest";
import {
  rowsToDailyNode,
  dailyNodeToRows,
  dailyUpdatesToPatches,
  assertDailyId,
  assertDailyDate,
  type ItemsMetaDailyRow,
  type DailiesPayloadRow,
} from "../src/services/dailiesUnifiedMapper";

const USER = "00000000-0000-0000-0000-000000000000";
const NOW = "2026-05-24T12:00:00.000Z";

function freshMeta(
  overrides: Partial<ItemsMetaDailyRow> = {},
): ItemsMetaDailyRow {
  return {
    id: "daily-2026-05-24",
    user_id: USER,
    role: "daily",
    title: "2026-05-24",
    is_deleted: false,
    deleted_at: null,
    created_at: "2026-05-24T10:00:00.000Z",
    updated_at: "2026-05-24T11:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

function freshPayload(
  overrides: Partial<DailiesPayloadRow> = {},
): DailiesPayloadRow {
  return {
    item_id: "daily-2026-05-24",
    user_id: USER,
    date: "2026-05-24",
    content_json: { type: "doc" },
    is_pinned: false,
    is_edit_locked: false,
    has_password: false,
    ...overrides,
  };
}

describe("dailiesUnifiedMapper", () => {
  it("roundtrips meta+payload -> DailyNode -> insert rows", () => {
    const meta = freshMeta();
    const payload = freshPayload();
    const node = rowsToDailyNode(meta, payload);
    const { meta: insertMeta, payload: insertPayload } = dailyNodeToRows(
      node,
      USER,
    );

    expect(insertMeta.id).toBe(meta.id);
    expect(insertMeta.role).toBe("daily");
    expect(insertMeta.title).toBe(payload.date); // title := date by convention
    expect(insertMeta.version).toBe(1);

    expect(insertPayload.item_id).toBe(payload.item_id);
    expect(insertPayload.date).toBe(payload.date);
    expect(insertPayload.is_pinned).toBe(false);
    // has_password is generated stored — must NOT be on the write type
    expect("has_password" in insertPayload).toBe(false);
  });

  it("content_json (object) <-> content (string) round-trips losslessly", () => {
    const doc = { type: "doc", content: [{ type: "paragraph" }] };
    const node = rowsToDailyNode(
      freshMeta(),
      freshPayload({ content_json: doc }),
    );
    expect(node.content).toBe(JSON.stringify(doc));
    const back = dailyNodeToRows(node, USER);
    expect(back.payload.content_json).toEqual(doc);
  });

  it("content_json null materializes as empty string and writes back as null", () => {
    const node = rowsToDailyNode(
      freshMeta(),
      freshPayload({ content_json: null }),
    );
    expect(node.content).toBe("");
    const back = dailyNodeToRows(node, USER);
    expect(back.payload.content_json).toBeNull();
  });

  it("preserves is_pinned / is_edit_locked / has_password", () => {
    const node = rowsToDailyNode(
      freshMeta(),
      freshPayload({
        is_pinned: true,
        is_edit_locked: true,
        has_password: true,
      }),
    );
    expect(node.isPinned).toBe(true);
    expect(node.isEditLocked).toBe(true);
    expect(node.hasPassword).toBe(true);
  });

  it("propagates soft-delete from meta side", () => {
    const node = rowsToDailyNode(
      freshMeta({ is_deleted: true, deleted_at: NOW }),
      freshPayload(),
    );
    expect(node.isDeleted).toBe(true);
    expect(node.deletedAt).toBe(NOW);
  });

  it("dailyUpdatesToPatches ALWAYS emits metaPatch.updated_at (LWW)", () => {
    const empty = dailyUpdatesToPatches({}, USER, NOW);
    expect(empty.metaPatch).toEqual({ updated_at: NOW });
    expect(empty.payloadPatch).toEqual({});
  });

  it("content update flows through payload only (not meta)", () => {
    const { metaPatch, payloadPatch } = dailyUpdatesToPatches(
      { content: '{"type":"doc"}' },
      USER,
      NOW,
    );
    expect(metaPatch).toEqual({ updated_at: NOW });
    expect(payloadPatch).toEqual({ content_json: { type: "doc" } });
  });

  it("date update flows through both meta.title (= date) and payload.date", () => {
    const { metaPatch, payloadPatch } = dailyUpdatesToPatches(
      { date: "2026-05-25" },
      USER,
      NOW,
    );
    expect(metaPatch.title).toBe("2026-05-25");
    expect(payloadPatch.date).toBe("2026-05-25");
  });

  it("rejects meta.id / payload.item_id mismatch", () => {
    expect(() =>
      rowsToDailyNode(
        freshMeta({ id: "daily-2026-05-24" }),
        freshPayload({ item_id: "daily-2026-05-25" }),
      ),
    ).toThrow(/row mismatch/);
  });

  it("rejects items_meta.role != 'daily'", () => {
    const wrongRole = {
      ...freshMeta(),
      role: "note",
    } as unknown as ItemsMetaDailyRow;
    expect(() => rowsToDailyNode(wrongRole, freshPayload())).toThrow(
      /role expected "daily"/,
    );
  });
});

describe("dailiesUnifiedMapper — assertions", () => {
  it("assertDailyId accepts valid shape only", () => {
    expect(assertDailyId("daily-2026-05-24")).toBe("daily-2026-05-24");
    expect(() => assertDailyId("daily-bogus")).toThrow(/invalid id/);
    expect(() => assertDailyId("note-2026-05-24")).toThrow(/invalid id/);
  });

  it("assertDailyDate accepts ISO date only", () => {
    expect(assertDailyDate("2026-05-24")).toBe("2026-05-24");
    expect(() => assertDailyDate("2026/05/24")).toThrow(/invalid date/);
    expect(() => assertDailyDate("not-a-date")).toThrow(/invalid date/);
  });
});
