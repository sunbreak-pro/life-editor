import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { rejection } from "./rejection.js";

/*
 * The verification harness's round trip (#700 Step 2): seed → read → clean up,
 * with nothing left behind.
 *
 * Supabase is replaced by the in-memory table set below — the tools are for
 * verification and must not need a live DB to be verified themselves, and a
 * suite that wrote to the real project would be the very thing #700 exists to
 * avoid. The fake speaks the slice of PostgREST this package uses (filters,
 * ordering, range, maybeSingle), so the handlers under test run their real
 * code paths: seeding goes through createTodo / createScheduleItem /
 * createNote, and cleanup deletes payload-then-meta exactly as it would live.
 *
 * What is pinned here:
 *   - nothing runs, and nothing is written, outside verification mode
 *   - a seeded run is fully readable afterwards, both rows of the 2-row model
 *   - cleanup removes every row it seeded AND forgets it, so a second run is
 *     not needed and the ledger's emptiness is a real signal
 *   - a delete that fails leaves its item in the ledger, which is what makes
 *     "run it again" the whole recovery procedure
 */

type Row = Record<string, unknown>;

const fake = vi.hoisted(() => {
  const tables = new Map<string, Row[]>();
  /** "delete:events_payload" etc. — injected failures for the retry test. */
  const failures = new Set<string>();

  const rowsOf = (table: string): Row[] => {
    const existing = tables.get(table);
    if (existing) return existing;
    const created: Row[] = [];
    tables.set(table, created);
    return created;
  };

  const compare = (a: unknown, b: unknown): number => {
    if (a === b) return 0;
    if (a === null || a === undefined) return -1;
    if (b === null || b === undefined) return 1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a) < String(b) ? -1 : 1;
  };

  function makeBuilder(
    table: string,
    kind: "select" | "update" | "delete",
    patch?: Row,
  ) {
    const filters: Array<(row: Row) => boolean> = [];
    const sorts: Array<{ column: string; ascending: boolean }> = [];
    let window: { from: number; to: number } | null = null;
    let max: number | null = null;

    const run = () => {
      const store = rowsOf(table);
      if (failures.has(`${kind}:${table}`)) {
        return { data: null, error: { message: `injected ${kind} failure` } };
      }

      let matched = store.filter((row) => filters.every((f) => f(row)));
      // Applied last-key-first so the FIRST .order() ends up primary, the
      // way PostgREST reads a chain of them.
      for (const sort of [...sorts].reverse()) {
        matched = [...matched].sort(
          (a, b) =>
            compare(a[sort.column], b[sort.column]) * (sort.ascending ? 1 : -1),
        );
      }

      if (kind === "update") {
        for (const row of matched) Object.assign(row, patch);
        return { data: matched, error: null };
      }
      if (kind === "delete") {
        for (const row of matched) {
          const at = store.indexOf(row);
          if (at >= 0) store.splice(at, 1);
        }
        return { data: matched, error: null };
      }

      if (window) matched = matched.slice(window.from, window.to + 1);
      if (max !== null) matched = matched.slice(0, max);
      return { data: matched.map((row) => ({ ...row })), error: null };
    };

    const api = {
      eq(column: string, value: unknown) {
        filters.push((row) => row[column] === value);
        return api;
      },
      in(column: string, values: unknown[]) {
        const wanted = new Set(values);
        filters.push((row) => wanted.has(row[column]));
        return api;
      },
      is(column: string, value: unknown) {
        filters.push((row) => (row[column] ?? null) === value);
        return api;
      },
      not(column: string, _operator: string, value: unknown) {
        filters.push((row) => (row[column] ?? null) !== value);
        return api;
      },
      gte(column: string, value: unknown) {
        filters.push((row) => compare(row[column], value) >= 0);
        return api;
      },
      lt(column: string, value: unknown) {
        filters.push((row) => compare(row[column], value) < 0);
        return api;
      },
      lte(column: string, value: unknown) {
        filters.push((row) => compare(row[column], value) <= 0);
        return api;
      },
      order(column: string, options?: { ascending?: boolean }) {
        sorts.push({ column, ascending: options?.ascending !== false });
        return api;
      },
      range(from: number, to: number) {
        window = { from, to };
        return api;
      },
      limit(count: number) {
        max = count;
        return api;
      },
      maybeSingle() {
        const { data, error } = run();
        return Promise.resolve({
          data: Array.isArray(data) ? (data[0] ?? null) : null,
          error,
        });
      },
      then<T>(
        onFulfilled?: (value: ReturnType<typeof run>) => T,
        onRejected?: (reason: unknown) => T,
      ) {
        return Promise.resolve(run()).then(onFulfilled, onRejected);
      },
    };
    return api;
  }

  const client = {
    from(table: string) {
      return {
        insert(row: Row) {
          if (failures.has(`insert:${table}`)) {
            return Promise.resolve({
              data: null,
              error: { message: `injected insert failure` },
            });
          }
          const now = new Date().toISOString();
          rowsOf(table).push(
            table === "items_meta"
              ? { created_at: now, updated_at: now, ...row }
              : { ...row },
          );
          return Promise.resolve({ data: null, error: null });
        },
        select: (_columns?: string) => makeBuilder(table, "select"),
        update: (patch: Row) => makeBuilder(table, "update", patch),
        delete: () => makeBuilder(table, "delete"),
      };
    },
  };

  return { tables, failures, client, rowsOf };
});

vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => ({
    client: fake.client,
    userId: "verification-user",
  }),
  resetSupabaseForTests: () => {},
}));

const {
  seedVerificationState,
  readVerificationState,
  cleanupVerificationState,
} = await import("../src/handlers/verificationHandlers.js");
const { callTool } = await import("../src/tools.js");

const ledgerDir = mkdtempSync(join(tmpdir(), "life-editor-verify-"));
const ledgerFile = join(ledgerDir, "ledger.json");

const DATE = "2026-08-13";

const metaRows = () => fake.tables.get("items_meta") ?? [];
const readLedgerFile = () =>
  existsSync(ledgerFile)
    ? (JSON.parse(readFileSync(ledgerFile, "utf8")) as {
        runs: Array<{ runId: string; items: Array<{ id: string }> }>;
      })
    : { runs: [] };

beforeEach(() => {
  fake.tables.clear();
  fake.failures.clear();
  rmSync(ledgerFile, { force: true });
  process.env.LIFE_EDITOR_VERIFICATION_LEDGER = ledgerFile;
  process.env.LIFE_EDITOR_VERIFICATION_MODE = "1";
});

afterAll(() => {
  rmSync(ledgerDir, { recursive: true, force: true });
  delete process.env.LIFE_EDITOR_VERIFICATION_LEDGER;
  delete process.env.LIFE_EDITOR_VERIFICATION_MODE;
});

describe("the tools are inert outside verification mode", () => {
  beforeEach(() => {
    delete process.env.LIFE_EDITOR_VERIFICATION_MODE;
  });

  it.each([
    [
      "seed_verification_state",
      () => seedVerificationState({ date: DATE, preset: "busy_day" }),
    ],
    ["read_verification_state", () => readVerificationState({ date: DATE })],
    ["cleanup_verification_state", () => cleanupVerificationState({})],
  ])("%s refuses to run", async (name, call) => {
    const error = await rejection(call());
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain(`${name} is disabled`);
    expect(error.message).toContain("LIFE_EDITOR_VERIFICATION_MODE=1");
  });

  it("writes nothing on the way to refusing", async () => {
    await seedVerificationState({ date: DATE, preset: "busy_day" }).catch(
      () => undefined,
    );
    expect(metaRows()).toHaveLength(0);
    expect(existsSync(ledgerFile)).toBe(false);
  });

  it("stays refused for a value that is not a yes", async () => {
    process.env.LIFE_EDITOR_VERIFICATION_MODE = "0";
    await expect(cleanupVerificationState({})).rejects.toThrow("is disabled");
  });
});

describe("seed → read → cleanup", () => {
  it("seeds the busy_day preset and remembers every row", async () => {
    const run = await seedVerificationState({
      date: DATE,
      preset: "busy_day",
      label: "#700",
    });

    expect(run.runId).toMatch(/^verify-/);
    expect(run.seeded).toHaveLength(6);
    expect(metaRows()).toHaveLength(6);
    // Written to disk, not just held in memory: the process that cleans up
    // is often not the one that seeded.
    expect(
      readLedgerFile()
        .runs[0].items.map((i) => i.id)
        .sort(),
    ).toEqual(run.seeded.map((i) => i.id).sort());
  });

  it("builds the day the preset promises", async () => {
    const run = await seedVerificationState({ date: DATE, preset: "busy_day" });
    const { items } = await readVerificationState({ run_id: run.runId });

    const events = items.filter((i) => i.role === "event");
    const todos = items.filter((i) => i.role === "task");
    expect(events).toHaveLength(3);
    expect(todos).toHaveLength(3);

    // Two events overlapping, and one all-day event storing no times.
    const timed = events
      .map((e) => e.payload as Row)
      .filter((p) => p.start_time !== null)
      .map((p) => `${p.start_time}-${p.end_time}`)
      .sort();
    expect(timed).toEqual(["09:00-10:00", "09:30-10:30"]);
    const allDay = events.find((e) => (e.payload as Row).is_all_day === true);
    expect(allDay?.payload).toMatchObject({ start_time: null, end_time: null });

    // A finished todo carries its completion instant, and exactly one todo is
    // left undated — the backlog row layout code forgets about.
    const done = todos.filter((t) => (t.payload as Row).status === "DONE");
    expect(done).toHaveLength(1);
    expect((done[0].payload as Row).completed_at).not.toBeNull();
    expect(
      todos.filter((t) => (t.payload as Row).scheduled_at === null),
    ).toHaveLength(1);
  });

  it("returns both rows of the 2-row model in one object", async () => {
    const run = await seedVerificationState({
      date: DATE,
      items: [{ kind: "note", title: "手書きのノート", content: "本文" }],
    });

    const { items, missing } = await readVerificationState({
      run_id: run.runId,
    });
    expect(missing).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0].meta).toMatchObject({
      role: "note",
      title: "[verify] 手書きのノート",
      is_deleted: false,
    });
    expect(items[0].meta.updated_at).toEqual(expect.any(String));
    expect(items[0].payload).toMatchObject({ item_id: items[0].id });
  });

  it("reads a day without being told what is on it", async () => {
    await seedVerificationState({ date: DATE, preset: "busy_day" });
    const { items } = await readVerificationState({ date: DATE });

    // 3 events + the 2 scheduled todos. The undated todo is not on this day,
    // and saying otherwise would be the answer-a-different-question failure.
    expect(items).toHaveLength(5);
    expect(items.every((i) => i.payload !== null)).toBe(true);
  });

  it("still shows an item the UI has stopped showing", async () => {
    const run = await seedVerificationState({
      date: DATE,
      items: [{ kind: "task", title: "消えた Todo" }],
    });
    const id = run.seeded[0].id;

    // What delete_todo does: soft, so the row survives for TrashView.
    const meta = metaRows().find((row) => row.id === id) as Row;
    meta.is_deleted = true;
    meta.deleted_at = new Date().toISOString();

    const { items } = await readVerificationState({ id });
    expect(items).toHaveLength(1);
    expect(items[0].meta.is_deleted).toBe(true);
  });

  it("reports an id that is not there instead of an empty success", async () => {
    const { items, missing } = await readVerificationState({ id: "task-nope" });
    expect(items).toEqual([]);
    expect(missing).toEqual(["task-nope"]);
  });

  it("deletes every seeded row and forgets the run", async () => {
    const run = await seedVerificationState({ date: DATE, preset: "busy_day" });

    const result = await cleanupVerificationState({ run_id: run.runId });

    expect(result.deleted).toBe(6);
    expect(result.failures).toEqual([]);
    expect(metaRows()).toHaveLength(0);
    expect(fake.rowsOf("tasks_payload")).toHaveLength(0);
    expect(fake.rowsOf("events_payload")).toHaveLength(0);
    expect(result.remainingRuns).toEqual([]);
    expect(readLedgerFile().runs).toEqual([]);
    // The order that matters: rows first, account second (there is no FK
    // from user_id to auth.users, so a deleted account strands its rows).
    expect(result.accountNote).toContain("rows first, account second");
  });

  it("cleans every run when told no run in particular", async () => {
    await seedVerificationState({ date: DATE, items: [{ kind: "task" }] });
    await seedVerificationState({ date: DATE, items: [{ kind: "note" }] });
    expect(readLedgerFile().runs).toHaveLength(2);

    const result = await cleanupVerificationState({});
    expect(result.deleted).toBe(2);
    expect(metaRows()).toHaveLength(0);
  });
});

describe("cleanup keeps its promises when something goes wrong", () => {
  it("deletes nothing on a dry run", async () => {
    const run = await seedVerificationState({ date: DATE, preset: "busy_day" });

    const result = await cleanupVerificationState({
      run_id: run.runId,
      dry_run: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.deleted).toBe(0);
    expect(result.wouldDelete[0].items).toHaveLength(6);
    expect(metaRows()).toHaveLength(6);
    expect(readLedgerFile().runs[0].items).toHaveLength(6);
  });

  it("leaves a row in the ledger when its delete fails", async () => {
    const run = await seedVerificationState({ date: DATE, preset: "busy_day" });
    fake.failures.add("delete:events_payload");

    const result = await cleanupVerificationState({ run_id: run.runId });

    // The 3 todos went; the 3 events did not, and are still written down.
    expect(result.deleted).toBe(3);
    expect(result.failures).toHaveLength(3);
    expect(result.accountNote).toContain(
      "Do NOT delete the verification account",
    );
    expect(readLedgerFile().runs[0].items).toHaveLength(3);

    // Re-running after the fault clears finishes the job — no id typed by hand.
    fake.failures.clear();
    const retry = await cleanupVerificationState({ run_id: run.runId });
    expect(retry.deleted).toBe(3);
    expect(metaRows()).toHaveLength(0);
    expect(readLedgerFile().runs).toEqual([]);
  });

  it("records the rows a half-failed seed already wrote", async () => {
    fake.failures.add("insert:notes_payload");

    const run = await seedVerificationState({
      date: DATE,
      items: [{ kind: "task", title: "先に入る" }, { kind: "note" }],
    }).catch((e: unknown) => e as Error);

    expect(run).toBeInstanceOf(Error);
    // The todo landed before the note failed. Unrecorded, it would be exactly
    // the leftover this harness exists to prevent — so the ledger has it, and
    // cleanup can still take it out.
    expect(readLedgerFile().runs[0].items).toHaveLength(1);
    const result = await cleanupVerificationState({});
    expect(result.deleted).toBe(1);
    expect(metaRows()).toHaveLength(0);
  });

  it("refuses a run_id it has never seen", async () => {
    await expect(
      cleanupVerificationState({ run_id: "verify-nope" }),
    ).rejects.toThrow("Unknown run_id");
  });
});

describe("what the published schema allows", () => {
  it("rejects a daily, whose id would collide with a real entry", async () => {
    await expect(
      callTool("seed_verification_state", {
        date: DATE,
        items: [{ kind: "daily" }],
      }),
    ).rejects.toThrow(/items\[0\]\.kind must be one of/);
  });

  it("rejects an empty seed rather than recording a run of nothing", async () => {
    await expect(callTool("seed_verification_state", {})).rejects.toThrow(
      "Nothing to seed",
    );
  });

  it("names the presets it has when given one it does not", async () => {
    // Twice over: the published enum stops it at the gate, and the handler
    // says the same thing for a caller that arrives some other way.
    await expect(
      callTool("seed_verification_state", { preset: "quiet_day" }),
    ).rejects.toThrow(/must be one of busy_day/);
    await expect(
      seedVerificationState({ preset: "quiet_day" }),
    ).rejects.toThrow('Unknown preset "quiet_day" (available: busy_day)');
  });

  it("will not answer for a selector it was not given", async () => {
    await expect(
      callTool("read_verification_state", {
        date: DATE,
        id: "task-1",
      }),
    ).rejects.toThrow("exactly one of run_id, date or id");
  });

  it("dispatches through the registry like every other tool", async () => {
    const raw = await callTool("seed_verification_state", {
      date: DATE,
      items: [
        {
          kind: "event",
          title: "登録経路",
          start_time: "09:00",
          end_time: "09:15",
        },
      ],
    });
    const seeded = JSON.parse(raw.content[0].text) as {
      runId: string;
      seeded: Array<{ id: string }>;
    };
    expect(seeded.seeded).toHaveLength(1);
    expect(metaRows()).toHaveLength(1);

    await callTool("cleanup_verification_state", { run_id: seeded.runId });
    expect(metaRows()).toHaveLength(0);
  });
});
