// @vitest-environment node (#1079 — this suite touches no DOM)
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

/*
 * #2107 — the two evening columns of 0034. The DataService gained no method
 * for them: `updateDailyUnified(id, Partial<DailyNode>)` already hands its
 * diff to this mapper, so the mapper is the whole read / write path.
 */
describe("dailiesUnifiedMapper — evening_published_at / evening_notes (#2107)", () => {
  it("reads both columns, null when absent", () => {
    const blank = rowsToDailyNode(freshMeta(), freshPayload());
    expect(blank.eveningPublishedAt).toBeNull();
    expect(blank.eveningNotes).toBeNull();

    const node = rowsToDailyNode(
      freshMeta(),
      freshPayload({
        evening_published_at: NOW,
        evening_notes: { "todo:t1": "良かった" },
      }),
    );
    expect(node.eveningPublishedAt).toBe(NOW);
    expect(node.eveningNotes).toEqual({ "todo:t1": "良かった" });
  });

  it("reads a notes value that is not a map of strings as no notes", () => {
    for (const bad of [[], "x", { "todo:t1": 3 }, {}]) {
      const node = rowsToDailyNode(
        freshMeta(),
        freshPayload({
          evening_notes: bad as unknown as Record<string, string>,
        }),
      );
      expect(node.eveningNotes).toBeNull();
    }
  });

  it("drops only the non-string entries, so the next note save keeps the rest", () => {
    const node = rowsToDailyNode(
      freshMeta(),
      freshPayload({
        evening_notes: {
          "todo:a": "x",
          "session:b": { odd: true },
        } as unknown as Record<string, string>,
      }),
    );
    expect(node.eveningNotes).toEqual({ "todo:a": "x" });
  });

  it("patches them through the payload, null included, and still bumps updated_at", () => {
    const { metaPatch, payloadPatch } = dailyUpdatesToPatches(
      { eveningPublishedAt: null, eveningNotes: { "event:e1": "混んでいた" } },
      USER,
      NOW,
    );
    // LWW: the cursor moves on every patch; the payload carries none.
    expect(metaPatch).toEqual({ updated_at: NOW });
    expect(payloadPatch).toEqual({
      evening_published_at: null,
      evening_notes: { "event:e1": "混んでいた" },
    });
  });

  it("emits neither column when the update does not name it", () => {
    const { payloadPatch } = dailyUpdatesToPatches({ content: "" }, USER, NOW);
    expect("evening_published_at" in payloadPatch).toBe(false);
    expect("evening_notes" in payloadPatch).toBe(false);
  });

  it("inserts them only when the node carries them", () => {
    const plain = dailyNodeToRows(
      {
        id: "daily-2026-05-24",
        date: "2026-05-24",
        content: "",
        createdAt: NOW,
        updatedAt: NOW,
      },
      USER,
    );
    expect("evening_published_at" in plain.payload).toBe(false);
    expect("evening_notes" in plain.payload).toBe(false);

    const withNotes = dailyNodeToRows(
      {
        id: "daily-2026-05-24",
        date: "2026-05-24",
        content: "",
        eveningNotes: { "todo:t1": "a" },
        createdAt: NOW,
        updatedAt: NOW,
      },
      USER,
    );
    expect(withNotes.payload.evening_notes).toEqual({ "todo:t1": "a" });
  });
});

/*
 * 0035 (D-20261007-briefing-1) — Claude's morning comment moved out of the
 * body into `morning_comment`. Same path as the evening columns: the mapper
 * is the whole read / write, and a column that holds nothing readable reads
 * as null so the readers fall back to an older day's 朝刊 section.
 */
describe("dailiesUnifiedMapper — morning_comment (0035)", () => {
  const COMMENT = [
    "今週の『企画書を通す』は残り 2 件です。初稿を午前に送れば、明日の見積もりに回せます。",
    "午後は歯科検診で抜けるので、集中が要る作業は午前に寄せるのがよさそうです。",
  ];

  it("reads the column, null when absent", () => {
    expect(rowsToDailyNode(freshMeta(), freshPayload()).morningComment).toBe(
      null,
    );
    const node = rowsToDailyNode(
      freshMeta(),
      freshPayload({ morning_comment: COMMENT }),
    );
    expect(node.morningComment).toEqual(COMMENT);
  });

  it("reads a value that is not an array, or an array with nothing readable, as null", () => {
    for (const bad of [null, "x", { 0: "a" }, 3, [], ["", "  "], [1, null]]) {
      const node = rowsToDailyNode(
        freshMeta(),
        freshPayload({ morning_comment: bad }),
      );
      expect(node.morningComment).toBeNull();
    }
  });

  it("drops only the non-string and blank elements", () => {
    const node = rowsToDailyNode(
      freshMeta(),
      freshPayload({ morning_comment: ["a", 2, "  ", "b"] }),
    );
    expect(node.morningComment).toEqual(["a", "b"]);
  });

  it("patches it through the payload, null included, and still bumps updated_at", () => {
    const set = dailyUpdatesToPatches({ morningComment: COMMENT }, USER, NOW);
    expect(set.metaPatch).toEqual({ updated_at: NOW });
    expect(set.payloadPatch).toEqual({ morning_comment: COMMENT });

    const cleared = dailyUpdatesToPatches({ morningComment: null }, USER, NOW);
    expect(cleared.payloadPatch).toEqual({ morning_comment: null });
  });

  it("emits no column when the update does not name it — a body save keeps the comment", () => {
    const { payloadPatch } = dailyUpdatesToPatches(
      { content: '{"type":"doc","content":[]}' },
      USER,
      NOW,
    );
    expect("morning_comment" in payloadPatch).toBe(false);
  });

  it("inserts it only when the node carries it", () => {
    const base = {
      id: "daily-2026-05-24",
      date: "2026-05-24",
      content: "",
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect("morning_comment" in dailyNodeToRows(base, USER).payload).toBe(
      false,
    );
    expect(
      dailyNodeToRows({ ...base, morningComment: COMMENT }, USER).payload
        .morning_comment,
    ).toEqual(COMMENT);
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
