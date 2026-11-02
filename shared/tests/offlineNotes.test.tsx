import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import {
  clearDomainSnapshots,
  readDomainSnapshot,
  writeDomainSnapshot,
} from "../src/state/domainSnapshotStore";
import {
  clearNoteBodies,
  rememberNoteBody,
} from "../src/state/noteBodyStore";
import {
  OutboxSendError,
  coalesceNoteBody,
  getOutboxCounts,
  isNoteEntry,
  isSendable,
  queueNote,
  readFailedOutboxCopy,
  readNoteEntries,
  readOutbox,
  refreshOutboxCounts,
  type NoteOutboxEntry,
} from "../src/state/outbox";
import {
  subscribeNoteConflicts,
  subscribeNoteSeparated,
  type NoteSendConflict,
  type NoteSeparatedNotice,
} from "../src/state/noteSendEvents";
import {
  createOfflineDataService,
  createOutboxSender,
} from "../src/services/offlineDataService";
import { useBodySyncSession } from "../src/hooks/useBodySyncSession";
import { blockText, docBlocks } from "../src/utils/blockMerge";
import type { DataService } from "../src/services/DataService";
import type { NoteBodySaveResult, NoteNode } from "../src/types/note";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #2337 — a note's trip through the outbox: held while offline, then sent with
 * the version it was based on. The server here is a small stand-in that behaves
 * like update_note_content (0032) and the idempotent create.
 */

const NETWORK = "saveNoteBodyUnified failed: TypeError: Failed to fetch";
const V0 = "2026-10-01T09:00:00.000Z";
const V1 = "2026-10-01T10:00:00.000Z";

const p = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const doc = (...lines: string[]) =>
  JSON.stringify({ type: "doc", content: lines.map(p) });
const texts = (body: string) => docBlocks(body).map(blockText);

const note = (id: string, over: Partial<NoteNode> = {}): NoteNode => ({
  id,
  type: "note",
  title: "Plan",
  content: "",
  parentId: null,
  order: 0,
  isPinned: true,
  isDeleted: false,
  createdAt: V0,
  updatedAt: V0,
  ...over,
});

interface Row {
  content: string;
  updatedAt: string;
  title: string;
}

function server(rows: Record<string, Partial<Row>> = {}) {
  const table = new Map<string, Row>(
    Object.entries(rows).map(([id, row]) => [
      id,
      { content: "", updatedAt: V0, title: "Plan", ...row },
    ]),
  );
  let clock = 0;
  const bump = () => `2026-10-02T00:00:${String(++clock).padStart(2, "0")}.000Z`;
  const snapshot = async (id: string) => {
    const row = table.get(id);
    return row ? { content: row.content, updatedAt: row.updatedAt } : null;
  };
  const target = {
    table,
    sendNoteBody: vi.fn(
      async (
        id: string,
        content: string,
        expected: string,
      ): Promise<NoteBodySaveResult> => {
        const row = table.get(id);
        if (!row) return { status: "missing" };
        if (row.updatedAt !== expected) {
          return {
            status: "conflict",
            current: { content: row.content, updatedAt: row.updatedAt },
          };
        }
        row.content = content;
        row.updatedAt = bump();
        return { status: "saved", updatedAt: row.updatedAt };
      },
    ),
    createNoteIfAbsent: vi.fn(async (node: NoteNode) => {
      const created = !table.has(node.id);
      if (created) {
        table.set(node.id, {
          content: node.content,
          updatedAt: bump(),
          title: node.title,
        });
      }
      return { created, current: await snapshot(node.id) };
    }),
    getNoteBodySnapshotUnified: vi.fn(snapshot),
    createTodoIfAbsent: vi.fn(),
    /** Someone else writes: another device, or MCP. */
    writeElsewhere(id: string, content: string) {
      const row = table.get(id)!;
      row.content = content;
      row.updatedAt = bump();
    },
  };
  return target;
}

let n = 0;
let user: string;
const owner = async () => user;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  user = `user-${++n}`;
  clearDomainSnapshots();
  clearNoteBodies();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const entries = () => readNoteEntries(user);

/** The wrapper with a dead network, and the list row the eligibility reads. */
function offlineDs(
  rows: NoteNode[] = [note("n1")],
  over: Record<string, unknown> = {},
): DataService {
  const ds = createOfflineDataService(
    stubDataService({
      saveNoteBodyUnified: vi.fn().mockRejectedValue(new Error(NETWORK)),
      createNoteUnified: vi
        .fn()
        .mockRejectedValue(new Error("createNoteUnified: Failed to fetch")),
      updateNoteUnified: vi.fn().mockRejectedValue(new Error(NETWORK)),
      softDeleteNoteUnified: vi.fn().mockResolvedValue(undefined),
      permanentDeleteNoteUnified: vi.fn().mockResolvedValue(undefined),
      getNoteUnified: vi.fn().mockRejectedValue(new Error(NETWORK)),
      getNoteBodySnapshotUnified: vi.fn().mockRejectedValue(new Error(NETWORK)),
      listNotesUnified: vi.fn().mockResolvedValue([]),
      ...over,
    }),
    owner,
  );
  writeDomainSnapshot("notes", ds, undefined, rows);
  return ds;
}

/** What the editor does: save against the version the base is stored under. */
async function editOffline(
  ds: DataService,
  id: string,
  base: string,
  ...bodies: string[]
): Promise<void> {
  rememberNoteBody(ds, id, V0, base);
  for (const body of bodies) await ds.saveNoteBodyUnified(id, body, V0);
}

const send = (target: ReturnType<typeof server>, onSent = vi.fn()) =>
  createOutboxSender(target as unknown as DataService, owner)
    .run(onSent)
    .then(() => onSent);

describe("creating a note offline", () => {
  it("queues it with its mark, and every read still finds it", async () => {
    const ds = offlineDs([]);
    const created = await ds.createNoteUnified(
      note("n9", { isPinned: false, content: doc("first") }),
    );
    expect(created.createdOffline).toBe(true);

    const [entry] = await entries();
    expect(entry).toMatchObject({ kind: "note.create", itemId: "n9", rev: 0 });

    const stored = readDomainSnapshot<NoteNode[]>("notes", ds, undefined);
    expect(stored?.data[0]).toMatchObject({ id: "n9", createdOffline: true });
    // The list never carries bodies, on the device either.
    expect(stored?.data[0]?.content).toBe("");

    expect(await ds.listNotesUnified()).toEqual([
      expect.objectContaining({ id: "n9", createdOffline: true, content: "" }),
    ]);
    expect((await ds.getNoteUnified("n9"))?.content).toBe(doc("first"));
  });

  it("takes a later body into the same entry", async () => {
    const ds = offlineDs([]);
    await ds.createNoteUnified(note("n9", { isPinned: false }));
    await ds.updateNoteUnified("n9", { content: doc("a") });
    await ds.saveNoteBodyUnified("n9", doc("a", "b"), V0);

    const all = await entries();
    expect(all).toHaveLength(1);
    expect(all[0]?.kind).toBe("note.create");
    expect(all[0]?.payload.node.content).toBe(doc("a", "b"));
    expect(all[0]?.rev).toBe(2);
  });

  it("does not queue a template, a locked note or a refusal", async () => {
    const ds = offlineDs([]);
    await expect(
      ds.createNoteUnified(note("t", { type: "template" })),
    ).rejects.toThrow("Failed to fetch");
    await expect(
      ds.createNoteUnified(note("l", { hasPassword: true })),
    ).rejects.toThrow("Failed to fetch");
    const refused = offlineDs([], {
      createNoteUnified: vi.fn().mockRejectedValue(new Error("row-level")),
    });
    await expect(refused.createNoteUnified(note("r"))).rejects.toThrow(
      "row-level",
    );
    expect(await entries()).toEqual([]);
  });

  it("sends it so that sending again leaves one note", async () => {
    const ds = offlineDs([]);
    await ds.createNoteUnified(note("n9", { content: doc("x") }));
    const target = server();
    // The write lands and the answer is lost.
    target.createNoteIfAbsent.mockImplementationOnce(async (node) => {
      target.table.set(node.id, {
        content: node.content,
        updatedAt: V1,
        title: node.title,
      });
      throw new Error("createNoteIfAbsent: Failed to fetch");
    });

    await send(target);
    expect(await entries()).toHaveLength(1);
    expect(target.table.size).toBe(1);

    const onSent = await send(target);
    expect(await entries()).toEqual([]);
    expect(target.table.size).toBe(1);
    expect(target.table.get("n9")?.content).toBe(doc("x"));
    expect(onSent).toHaveBeenCalledWith(["notes"]);
  });

  it("clears the mark once sent", async () => {
    const ds = offlineDs([]);
    await ds.createNoteUnified(note("n9"));
    await send(server());
    const stored = readDomainSnapshot<NoteNode[]>("notes", ds, undefined);
    expect(stored?.data[0]?.createdOffline).toBeUndefined();
    expect(await ds.listNotesUnified()).toEqual([]);
  });

  it("sends an edit made after the lost answer against the row it left", async () => {
    const ds = offlineDs([]);
    await ds.createNoteUnified(note("n9", { content: doc("one") }));
    const target = server();
    target.createNoteIfAbsent.mockImplementationOnce(async (node) => {
      target.table.set(node.id, {
        content: node.content,
        updatedAt: V1,
        title: node.title,
      });
      throw new Error("createNoteIfAbsent: Failed to fetch");
    });
    await send(target);

    await ds.saveNoteBodyUnified("n9", doc("one", "two"), V0);
    await send(target);

    expect(await entries()).toEqual([]);
    expect(texts(target.table.get("n9")!.content)).toEqual(["one", "two"]);
    expect(target.table.size).toBe(1);
  });

  it("finishes a create whose first write landed with its answer lost", async () => {
    const target = server({ n9: { content: doc("one") } });
    const ds = offlineDs([]);
    await ds.createNoteUnified(note("n9", { content: doc("one") }));
    await ds.saveNoteBodyUnified("n9", doc("one", "typed"), V0);

    await send(target);

    expect(texts(target.table.get("n9")!.content)).toEqual(["one", "typed"]);
    expect(target.table.size).toBe(1);
    expect(await entries()).toEqual([]);
  });

  it("drops the entry on the undo of the create", async () => {
    const ds = offlineDs([]);
    await ds.createNoteUnified(note("n9"));
    await ds.permanentDeleteNoteUnified("n9");
    expect(await entries()).toEqual([]);
    expect(
      readDomainSnapshot<NoteNode[]>("notes", ds, undefined)?.data,
    ).toEqual([]);
  });
});

describe("editing a note offline", () => {
  it("queues a pinned note's body with the base stored for that version", async () => {
    const ds = offlineDs();
    rememberNoteBody(ds, "n1", V0, doc("base"));
    const result = await ds.saveNoteBodyUnified("n1", doc("mine"), V0);

    expect(result).toEqual({ status: "saved", updatedAt: V0 });
    const [entry] = await entries();
    expect(entry).toMatchObject({
      kind: "note.body",
      itemId: "n1",
      baseUpdatedAt: V0,
      baseContent: doc("base"),
    });
    expect(entry?.payload.node.content).toBe(doc("mine"));
  });

  it("keeps the first base and the latest body in one entry", async () => {
    const ds = offlineDs();
    await editOffline(ds, "n1", doc("base"), doc("a"));
    // The hook's own effect has replaced the store's slot by now.
    rememberNoteBody(ds, "n1", "client-clock", doc("a"));
    const second = await ds.saveNoteBodyUnified("n1", doc("a", "b"), V0);

    expect(second).toEqual({ status: "saved", updatedAt: V0 });
    const all = await entries();
    expect(all).toHaveLength(1);
    expect(all[0]?.baseContent).toBe(doc("base"));
    expect(all[0]?.payload.node.content).toBe(doc("a", "b"));
  });

  it("goes on saving into the box after the network is back", async () => {
    const saveNoteBodyUnified = vi
      .fn()
      .mockRejectedValueOnce(new Error(NETWORK));
    const ds = offlineDs([note("n1")], { saveNoteBodyUnified });
    await editOffline(ds, "n1", doc("base"), doc("a"), doc("a", "b"));
    expect(saveNoteBodyUnified).toHaveBeenCalledTimes(1);
    expect((await entries())[0]?.payload.node.content).toBe(doc("a", "b"));
  });

  it("answers reads with the waiting body, so an open sees no false conflict", async () => {
    const ds = offlineDs();
    await editOffline(ds, "n1", doc("base"), doc("mine"));
    expect(await ds.getNoteBodySnapshotUnified("n1")).toEqual({
      content: doc("mine"),
      updatedAt: V0,
    });
    expect((await ds.getNoteUnified("n1"))?.content).toBe(doc("mine"));
  });

  it("does not pretend to save an unpinned note", async () => {
    const ds = offlineDs([note("n1", { isPinned: false })]);
    rememberNoteBody(ds, "n1", V0, doc("base"));
    await expect(
      ds.saveNoteBodyUnified("n1", doc("mine"), V0),
    ).rejects.toThrow(NETWORK);
    expect(await entries()).toEqual([]);
  });

  it("never holds a locked note, pinned or not", async () => {
    const ds = offlineDs([note("n1", { hasPassword: true })]);
    await expect(
      ds.saveNoteBodyUnified("n1", doc("secret"), V0),
    ).rejects.toThrow(NETWORK);
    expect(await readOutbox(user)).toEqual([]);
  });

  it("does not guess at a note the list has never shown", async () => {
    const ds = offlineDs([]);
    await expect(
      ds.saveNoteBodyUnified("unknown", doc("mine"), V0),
    ).rejects.toThrow(NETWORK);
    expect(await entries()).toEqual([]);
  });

  it("does not hold a refusal, only a network failure", async () => {
    const ds = offlineDs([note("n1")], {
      saveNoteBodyUnified: vi.fn().mockRejectedValue(new Error("row-level")),
    });
    await expect(
      ds.saveNoteBodyUnified("n1", doc("mine"), V0),
    ).rejects.toThrow("row-level");
    expect(await entries()).toEqual([]);
  });

  it("stores a landed save's pair, which a later offline edit reads as its base", async () => {
    const saveNoteBodyUnified = vi
      .fn()
      .mockResolvedValueOnce({ status: "saved", updatedAt: V1 })
      .mockRejectedValue(new Error(NETWORK));
    const ds = offlineDs([note("n1")], { saveNoteBodyUnified });
    await ds.saveNoteBodyUnified("n1", doc("online"), V0);
    await ds.saveNoteBodyUnified("n1", doc("online", "offline"), V1);
    expect((await entries())[0]).toMatchObject({
      baseUpdatedAt: V1,
      baseContent: doc("online"),
    });
  });

  it("learns a pin from the write, for the next offline save", async () => {
    const ds = offlineDs([note("n1", { isPinned: false })], {
      updateNoteUnified: vi.fn().mockResolvedValue(note("n1")),
    });
    await ds.updateNoteUnified("n1", { isPinned: true });
    rememberNoteBody(ds, "n1", V0, doc("base"));
    await ds.saveNoteBodyUnified("n1", doc("mine"), V0);
    expect(await entries()).toHaveLength(1);
  });

  it("refuses a rename of a note that is not on the server yet", async () => {
    const ds = offlineDs([]);
    await ds.createNoteUnified(note("n9"));
    await expect(
      ds.updateNoteUnified("n9", { title: "Later" }),
    ).rejects.toThrow("waits in the outbox");
    expect((await entries())[0]?.payload.node.title).toBe("Plan");
  });

  it("refuses to trash a waiting note with text, and drops a blank one", async () => {
    const ds = offlineDs([]);
    await ds.createNoteUnified(note("written", { content: doc("text") }));
    await expect(ds.softDeleteNoteUnified("written")).rejects.toThrow(
      "waits in the outbox",
    );
    await ds.createNoteUnified(note("blank"));
    await ds.softDeleteNoteUnified("blank");
    expect((await entries()).map((e) => e.itemId)).toEqual(["written"]);
  });
});

describe("sending a body edit", () => {
  const conflicts: NoteSendConflict[] = [];
  const notices: NoteSeparatedNotice[] = [];
  let unsubscribe: Array<() => void> = [];
  beforeEach(() => {
    conflicts.length = 0;
    notices.length = 0;
    unsubscribe = [
      subscribeNoteConflicts("n1", (c) => conflicts.push(c)),
      subscribeNoteSeparated((c) => notices.push(c)),
    ];
  });
  afterEach(() => unsubscribe.forEach((off) => off()));

  const copies = (target: ReturnType<typeof server>) =>
    [...target.table.keys()].filter((id) => id !== "n1");

  it("saved: clears the entry", async () => {
    const ds = offlineDs();
    await editOffline(ds, "n1", doc("base"), doc("mine"));
    const target = server({ n1: { content: doc("base") } });

    const onSent = await send(target);

    expect(target.sendNoteBody).toHaveBeenCalledWith(
      "n1",
      doc("mine"),
      V0,
      { ownerId: user },
    );
    expect(texts(target.table.get("n1")!.content)).toEqual(["mine"]);
    expect(await entries()).toEqual([]);
    expect(copies(target)).toEqual([]);
    expect(onSent).toHaveBeenCalledWith(["notes"]);
  });

  it("no overlap: merges and sends with the new version", async () => {
    const ds = offlineDs();
    const base = doc("a", "b");
    await editOffline(ds, "n1", base, doc("a mine", "b"));
    const target = server({ n1: { content: base } });
    target.writeElsewhere("n1", doc("a", "b theirs"));

    await send(target);

    expect(texts(target.table.get("n1")!.content)).toEqual([
      "a mine",
      "b theirs",
    ]);
    expect(await entries()).toEqual([]);
    expect(copies(target)).toEqual([]);
    expect(conflicts).toEqual([]);
  });

  it("merges again against the newest version when the retry is refused", async () => {
    const ds = offlineDs();
    const base = doc("a", "b", "c");
    await editOffline(ds, "n1", base, doc("a mine", "b", "c"));
    const target = server({ n1: { content: base } });
    target.writeElsewhere("n1", doc("a", "b theirs", "c"));
    const real = target.sendNoteBody.getMockImplementation()!;
    let raced = false;
    target.sendNoteBody.mockImplementation(async (id, content, expected) => {
      // Overtaken between the merge and its send.
      if (expected !== V0 && !raced) {
        raced = true;
        target.writeElsewhere("n1", doc("a", "b theirs", "c theirs"));
      }
      return real(id, content, expected);
    });

    await send(target);

    expect(texts(target.table.get("n1")!.content)).toEqual([
      "a mine",
      "b theirs",
      "c theirs",
    ]);
    expect(await entries()).toEqual([]);
  });

  it("keeps the text apart once the tries run out", async () => {
    const ds = offlineDs();
    const base = doc("a", "b");
    await editOffline(ds, "n1", base, doc("a mine", "b"));
    const target = server({ n1: { content: base } });
    const real = target.sendNoteBody.getMockImplementation()!;
    let i = 0;
    target.sendNoteBody.mockImplementation(async (id, content, expected) => {
      target.writeElsewhere("n1", doc("a", `b ${++i}`));
      return real(id, content, expected);
    });

    await send(target);

    expect(target.sendNoteBody).toHaveBeenCalledTimes(3);
    const [copy] = copies(target);
    expect(texts(target.table.get(copy!)!.content)).toEqual(["a mine", "b"]);
    expect(await entries()).toEqual([]);
  });

  it("overlap: leaves the server alone and keeps mine as a separate note", async () => {
    const ds = offlineDs();
    const base = doc("a");
    await editOffline(ds, "n1", base, doc("a mine"));
    const entry = (await entries())[0]!;
    const target = server({ n1: { content: base } });
    target.writeElsewhere("n1", doc("a theirs"));
    const theirs = target.table.get("n1")!.content;

    await send(target);

    expect(target.table.get("n1")!.content).toBe(theirs);
    expect(await entries()).toEqual([]);
    const id = `note-${entry.opId}-0`;
    expect(copies(target)).toEqual([id]);
    const copy = target.table.get(id)!;
    expect(texts(copy.content)).toEqual(["a mine"]);
    // Device local time, from the first edit (the suite's zone is Tokyo).
    const at = new Date(entry.createdAt);
    const pad = (x: number) => String(x).padStart(2, "0");
    expect(copy.title).toBe(
      `Plan（オフライン編集 ${at.getFullYear()}-${pad(at.getMonth() + 1)}-` +
        `${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}）`,
    );

    // The open editor hears of it, and the user is told.
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ base, mine: doc("a mine") });
    expect(conflicts[0]?.theirs.content).toBe(theirs);
    expect(notices).toEqual([{ title: copy.title, reason: "conflict" }]);
  });

  it("makes one separate note when the answer to its create is lost", async () => {
    const ds = offlineDs();
    await editOffline(ds, "n1", doc("a"), doc("a mine"));
    const target = server({ n1: { content: doc("a") } });
    target.writeElsewhere("n1", doc("a theirs"));
    const real = target.createNoteIfAbsent.getMockImplementation()!;
    target.createNoteIfAbsent.mockImplementationOnce(async (node) => {
      await real(node);
      throw new Error("createNoteIfAbsent: Failed to fetch");
    });

    await send(target);
    expect(await entries()).toHaveLength(1);
    expect(notices).toEqual([]);

    await send(target);
    expect(await entries()).toEqual([]);
    expect(copies(target)).toHaveLength(1);
    expect(notices).toHaveLength(1);
  });

  it("with no base at the first edit: never overwrites, and keeps mine apart", async () => {
    const ds = offlineDs();
    await ds.saveNoteBodyUnified("n1", doc("mine"), V0); // nothing stored for V0
    expect((await entries())[0]?.baseUpdatedAt).toBeNull();
    const target = server({ n1: { content: doc("theirs") } });

    await send(target);

    expect(target.sendNoteBody).not.toHaveBeenCalled();
    expect(texts(target.table.get("n1")!.content)).toEqual(["theirs"]);
    expect(texts(target.table.get(copies(target)[0]!)!.content)).toEqual([
      "mine",
    ]);
    expect(conflicts[0]?.base).toBe("");
  });

  it("with no base, a server that already holds mine is simply done", async () => {
    const ds = offlineDs();
    await ds.saveNoteBodyUnified("n1", doc("mine"), V0);
    const target = server({ n1: { content: doc("mine") } });
    await send(target);
    expect(await entries()).toEqual([]);
    expect(copies(target)).toEqual([]);
  });

  it("gone on the server: keeps the text as a separate note", async () => {
    const ds = offlineDs();
    await editOffline(ds, "n1", doc("base"), doc("mine"));
    const target = server();

    await send(target);

    expect(await entries()).toEqual([]);
    const [copy] = [...target.table.values()];
    expect(texts(copy!.content)).toEqual(["mine"]);
    expect(notices[0]?.reason).toBe("gone");
    expect(conflicts).toEqual([]);
  });

  it("a landed save whose answer was lost does not count as a conflict", async () => {
    const ds = offlineDs();
    await editOffline(ds, "n1", doc("base"), doc("mine"));
    const target = server({ n1: { content: doc("base") } });
    target.writeElsewhere("n1", doc("mine"));
    await send(target);
    expect(await entries()).toEqual([]);
    expect(copies(target)).toEqual([]);
  });

  it("a rename that moved the version only is sent through", async () => {
    const ds = offlineDs();
    await editOffline(ds, "n1", doc("base"), doc("mine"));
    const target = server({ n1: { content: doc("base") } });
    target.writeElsewhere("n1", doc("base"));
    await send(target);
    expect(texts(target.table.get("n1")!.content)).toEqual(["mine"]);
    expect(await entries()).toEqual([]);
  });

  it("a non-conflict refusal goes to the failed box, with readable text", async () => {
    const ds = offlineDs();
    await editOffline(ds, "n1", doc("base"), doc("mine"));
    const target = server({ n1: { content: doc("base") } });
    target.sendNoteBody.mockRejectedValue(
      new OutboxSendError("refused", 403, "42501"),
    );
    await refreshOutboxCounts(user);

    const onSent = await send(target);

    expect(getOutboxCounts()).toEqual({ pending: 0, failed: 1 });
    expect((await readFailedOutboxCopy()).text).toBe("Plan\nmine");
    expect(onSent).toHaveBeenCalledWith(["notes"]);
    expect(notices).toEqual([]);
  });

  it("a refused create leaves the list as well", async () => {
    const ds = offlineDs([]);
    await ds.createNoteUnified(note("n9"));
    const target = server();
    target.createNoteIfAbsent.mockRejectedValue(
      new OutboxSendError("refused", 403, "42501"),
    );
    await send(target);
    expect(
      readDomainSnapshot<NoteNode[]>("notes", ds, undefined)?.data,
    ).toEqual([]);
  });

  it.each([
    ["no session", new Error("getUserId failed: Auth session missing!")],
    ["another account", new Error("getUserId failed: account changed")],
    ["a 503", new OutboxSendError("busy", 503)],
    ["no network", new Error(NETWORK)],
  ])("stops and keeps the entry on %s", async (_label, error) => {
    const ds = offlineDs();
    await editOffline(ds, "n1", doc("base"), doc("mine"));
    const target = server({ n1: { content: doc("base") } });
    target.sendNoteBody.mockRejectedValue(error);
    const onSent = await send(target);
    expect(await entries()).toHaveLength(1);
    expect(onSent).not.toHaveBeenCalled();
  });

  it("sends nothing with no owner", async () => {
    const ds = offlineDs();
    await editOffline(ds, "n1", doc("base"), doc("mine"));
    const target = server({ n1: { content: doc("base") } });
    await createOutboxSender(
      target as unknown as DataService,
      async () => null,
    ).run(vi.fn());
    expect(target.sendNoteBody).not.toHaveBeenCalled();
    expect(await entries()).toHaveLength(1);
  });

  it("an edit made during the send is not lost or marked sent", async () => {
    const ds = offlineDs();
    await editOffline(ds, "n1", doc("base"), doc("mine"));
    const target = server({ n1: { content: doc("base") } });
    const real = target.sendNoteBody.getMockImplementation()!;
    target.sendNoteBody.mockImplementationOnce(async (id, content, expected) => {
      await ds.saveNoteBodyUnified(id, doc("mine", "more"), V0);
      return real(id, content, expected);
    });

    await send(target);

    expect(target.sendNoteBody).toHaveBeenCalledTimes(2);
    expect(texts(target.table.get("n1")!.content)).toEqual(["mine", "more"]);
    expect(await entries()).toEqual([]);
  });

  it("an edit during a merged send keeps what the merge brought in", async () => {
    const ds = offlineDs();
    const base = doc("a", "b", "c");
    await editOffline(ds, "n1", base, doc("a mine", "b", "c"));
    const target = server({ n1: { content: base } });
    target.writeElsewhere("n1", doc("a", "b theirs", "c"));
    const real = target.sendNoteBody.getMockImplementation()!;
    target.sendNoteBody
      .mockImplementationOnce(real)
      .mockImplementationOnce(async (id, content, expected) => {
        await ds.saveNoteBodyUnified(id, doc("a mine", "b", "c more"), V0);
        return real(id, content, expected);
      });

    await send(target);

    expect(texts(target.table.get("n1")!.content)).toEqual([
      "a mine",
      "b theirs",
      "c more",
    ]);
    expect(await entries()).toEqual([]);
  });

  it("an edit during a create waits as a body edit of the new row", async () => {
    const ds = offlineDs([]);
    await ds.createNoteUnified(note("n9", { content: doc("one") }));
    const target = server();
    const real = target.createNoteIfAbsent.getMockImplementation()!;
    target.createNoteIfAbsent.mockImplementationOnce(async (node) => {
      await ds.saveNoteBodyUnified("n9", doc("one", "two"), V0);
      return real(node);
    });

    await send(target);

    expect(texts(target.table.get("n9")!.content)).toEqual(["one", "two"]);
    expect(await entries()).toEqual([]);
    expect(target.createNoteIfAbsent).toHaveBeenCalledTimes(1);
  });

  it("does not send twice from two tabs", async () => {
    const ds = offlineDs();
    await editOffline(ds, "n1", doc("base"), doc("mine"));
    const target = server({ n1: { content: doc("base") } });
    let tail: Promise<unknown> = Promise.resolve();
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: (_name: string, run: () => Promise<unknown>) => {
          const next = tail.then(run);
          tail = next;
          return next;
        },
      },
    });
    try {
      await Promise.all([send(target), send(target)]);
    } finally {
      delete (navigator as { locks?: unknown }).locks;
    }
    expect(target.sendNoteBody).toHaveBeenCalledTimes(1);
  });

  it("leaves an open editor on the merged body, and a late save cannot undo it", async () => {
    const base = doc("a", "b");
    const mine = doc("a mine", "b");
    const target = server({ n1: { content: base } });
    target.writeElsewhere("n1", doc("a", "b theirs"));
    const saveNoteBodyUnified = vi.fn(
      (id: string, content: string, expected: string | null) =>
        target.sendNoteBody(id, content, expected ?? ""),
    );
    const ds = offlineDs([note("n1")], {
      saveNoteBodyUnified,
      getNoteBodySnapshotUnified: target.getNoteBodySnapshotUnified,
    });
    saveNoteBodyUnified.mockRejectedValueOnce(new Error(NETWORK));
    await editOffline(ds, "n1", base, mine);
    await send(target);
    const merged = target.table.get("n1")!;
    const mergedBody = merged.content;

    // The editor's debounced save of the older body lands after the send.
    expect(await ds.saveNoteBodyUnified("n1", mine, V0)).toMatchObject({
      status: "conflict",
    });
    expect(target.table.get("n1")!.content).toBe(mergedBody);

    // The list reload tells the session a new version exists.
    const session = renderHook(
      ({ remote }: { remote: string }) =>
        useBodySyncSession({
          initial: { content: mine, updatedAt: V0 },
          remoteUpdatedAt: remote,
          save: (content, expected) =>
            ds.saveNoteBodyUnified("n1", content, expected),
          fetchCurrent: () => ds.getNoteBodySnapshotUnified("n1"),
          readEditor: () => mine,
        }),
      { initialProps: { remote: V0 } },
    );
    await act(async () => {
      session.rerender({ remote: merged.updatedAt });
    });
    await waitFor(() =>
      expect(session.result.current.replacement?.content).toBe(mergedBody),
    );
    expect(session.result.current.conflict).toBeNull();
  });
});

describe("what an older tab meets in the box", () => {
  it("does not send a kind it does not know, and keeps it", async () => {
    const unknown = { kind: "daily.body", schemaVersion: 1 } as never;
    expect(isSendable(unknown)).toBe(false);
    const newer = { kind: "note.body", schemaVersion: 99 } as never;
    expect(isSendable(newer)).toBe(false);
  });

  it("finds the title and body a failed-box copy reads where it always did", async () => {
    const entry: NoteOutboxEntry = await queueNote(
      user,
      "note.body",
      note("n1", { content: doc("x") }),
      { updatedAt: V0, content: doc("base") },
    );
    expect(isNoteEntry(entry)).toBe(true);
    expect(entry.payload.node).toMatchObject({
      title: "Plan",
      content: doc("x"),
    });
  });

  it("coalesces nothing when nothing waits", async () => {
    expect(await coalesceNoteBody(user, "n1", doc("x"))).toBeNull();
    expect(await readOutbox(user)).toEqual([]);
  });
});
