// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseAiCustomizationService } from "../src/services/SupabaseAiCustomizationService";
import {
  AI_MEMORY_BODY_MAX_CHARS,
  AI_RULE_BODY_MAX_CHARS,
  AiCustomizationValidationError,
} from "../src/services/aiCustomizationLimits";

/*
 * SupabaseAiCustomizationService (#2118) against a small in-memory PostgREST
 * fake.
 *
 * What the suite pins:
 *   - reading the rule never writes (a missing row is null, #499);
 *   - every update sets the row's own updated_at (0037 — no items_meta row);
 *   - user_id is never sent (the DB default auth.uid() owns it);
 *   - a value past the 0037 limits is refused BEFORE any request, naming the
 *     field; a duplicate slug comes back as `taken`, not as a raw 23505;
 *   - memories append at the end and reorder by position.
 */

type Row = Record<string, unknown>;
type Order = { col: string; ascending: boolean };

interface Request {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "upsert";
  payload?: Row;
  onConflict?: string;
}

const UID = "11111111-2222-3333-4444-555555555555";
const T0 = "2026-10-01T00:00:00.000Z";

function makeFake(seed: Record<string, Row[]> = {}) {
  const db: Record<string, Row[]> = {
    ai_rules: [],
    ai_memories: [],
    ai_skills: [],
    ...seed,
  };
  const requests: Request[] = [];

  class Builder implements PromiseLike<{ data: unknown; error: unknown }> {
    private op: Request["op"] = "select";
    private payload: Row = {};
    private onConflict: string | undefined;
    private filters: [string, unknown][] = [];
    private orders: Order[] = [];
    private limitN: number | null = null;
    private rangeArgs: [number, number] | null = null;
    private singleMode: "one" | "maybe" | null = null;

    constructor(private readonly table: string) {}

    select(): this {
      return this;
    }
    insert(row: Row): this {
      this.op = "insert";
      this.payload = row;
      return this;
    }
    upsert(row: Row, opts: { onConflict: string }): this {
      this.op = "upsert";
      this.payload = row;
      this.onConflict = opts.onConflict;
      return this;
    }
    update(patch: Row): this {
      this.op = "update";
      this.payload = patch;
      return this;
    }
    delete(): this {
      this.op = "delete";
      return this;
    }
    eq(col: string, val: unknown): this {
      this.filters.push([col, val]);
      return this;
    }
    order(col: string, opts?: { ascending?: boolean }): this {
      this.orders.push({ col, ascending: opts?.ascending ?? true });
      return this;
    }
    limit(n: number): this {
      this.limitN = n;
      return this;
    }
    range(from: number, to: number): this {
      this.rangeArgs = [from, to];
      return this;
    }
    maybeSingle(): this {
      this.singleMode = "maybe";
      return this;
    }
    single(): this {
      this.singleMode = "one";
      return this;
    }

    private run(): { data: unknown; error: unknown } {
      requests.push({
        table: this.table,
        op: this.op,
        payload: this.op === "select" ? undefined : { ...this.payload },
        onConflict: this.onConflict,
      });
      const rows = db[this.table];
      const matches = (r: Row) =>
        this.filters.every(([col, val]) => r[col] === val);
      const now = new Date().toISOString();
      let out: Row[];

      if (this.op === "insert") {
        if (
          this.table === "ai_skills" &&
          rows.some((r) => r.slug === this.payload.slug)
        ) {
          return {
            data: null,
            error: { message: "duplicate key", code: "23505" },
          };
        }
        const row = {
          user_id: UID,
          created_at: now,
          updated_at: now,
          body: "",
          sort_order: 0,
          ...this.payload,
        };
        rows.push(row);
        out = [row];
      } else if (this.op === "upsert") {
        // ai_rules: conflict target is user_id, filled by the DB default.
        const existing = rows.find((r) => r.user_id === UID);
        if (existing) {
          Object.assign(existing, this.payload);
          out = [existing];
        } else {
          const row = { user_id: UID, created_at: now, ...this.payload };
          rows.push(row);
          out = [row];
        }
      } else if (this.op === "update") {
        out = rows.filter(matches);
        if (
          this.table === "ai_skills" &&
          rows.some((r) => !matches(r) && r.slug === this.payload.slug)
        ) {
          return {
            data: null,
            error: { message: "duplicate key", code: "23505" },
          };
        }
        for (const r of out) Object.assign(r, this.payload);
      } else if (this.op === "delete") {
        out = rows.filter(matches);
        db[this.table] = rows.filter((r) => !matches(r));
      } else {
        out = rows.filter(matches);
        for (const o of [...this.orders].reverse()) {
          out = [...out].sort((a, b) => {
            const x = a[o.col] as string | number;
            const y = b[o.col] as string | number;
            const c = x < y ? -1 : x > y ? 1 : 0;
            return o.ascending ? c : -c;
          });
        }
        if (this.limitN !== null) out = out.slice(0, this.limitN);
        if (this.rangeArgs) {
          out = out.slice(this.rangeArgs[0], this.rangeArgs[1] + 1);
        }
      }

      if (this.singleMode === "one") {
        return out.length === 1
          ? { data: { ...out[0] }, error: null }
          : { data: null, error: { message: "PGRST116: 0 rows" } };
      }
      if (this.singleMode === "maybe") {
        return { data: out[0] ? { ...out[0] } : null, error: null };
      }
      return { data: out.map((r) => ({ ...r })), error: null };
    }

    then<A = { data: unknown; error: unknown }, B = never>(
      onfulfilled?: (v: {
        data: unknown;
        error: unknown;
      }) => A | PromiseLike<A>,
      onrejected?: (reason: unknown) => B | PromiseLike<B>,
    ): PromiseLike<A | B> {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    }
  }

  const client = {
    from: (table: string) => new Builder(table),
  } as unknown as SupabaseClient;
  return { service: new SupabaseAiCustomizationService(client), db, requests };
}

function memory(id: string, sortOrder: number, body = id): Row {
  return {
    id,
    user_id: UID,
    body,
    sort_order: sortOrder,
    created_at: T0,
    updated_at: T0,
  };
}

function skill(id: string, slug: string): Row {
  return {
    id,
    user_id: UID,
    slug,
    description: `${slug} の説明`,
    body: "",
    created_at: T0,
    updated_at: T0,
  };
}

function writes(requests: Request[]): Request[] {
  return requests.filter((r) => r.op !== "select");
}

describe("rules", () => {
  it("reads null when nothing is saved, without writing", async () => {
    const { service, requests } = makeFake();
    expect(await service.fetchAiRule()).toBeNull();
    expect(writes(requests)).toEqual([]);
  });

  it("upserts on user_id and reads back what was saved", async () => {
    const { service, requests } = makeFake();
    const first = await service.saveAiRule("最初のルール");
    expect(first.body).toBe("最初のルール");
    await service.saveAiRule("書き直したルール");

    const upserts = requests.filter((r) => r.op === "upsert");
    expect(upserts).toHaveLength(2);
    for (const u of upserts) {
      expect(u.onConflict).toBe("user_id");
      expect(u.payload).not.toHaveProperty("user_id");
      expect(typeof u.payload?.updated_at).toBe("string");
    }
    expect((await service.fetchAiRule())?.body).toBe("書き直したルール");
  });

  it("refuses a body past the limit before sending anything", async () => {
    const { service, requests } = makeFake();
    await expect(
      service.saveAiRule("a".repeat(AI_RULE_BODY_MAX_CHARS + 1)),
    ).rejects.toMatchObject({ field: "body", issue: "tooLong" });
    expect(requests).toEqual([]);
  });
});

describe("memories", () => {
  it("lists in sort order", async () => {
    const { service } = makeFake({
      ai_memories: [memory("aimemory-b", 1), memory("aimemory-a", 0)],
    });
    expect((await service.fetchAiMemories()).map((m) => m.id)).toEqual([
      "aimemory-a",
      "aimemory-b",
    ]);
  });

  it("appends a new memory at the end with an aimemory- id", async () => {
    const { service, requests } = makeFake({
      ai_memories: [memory("aimemory-a", 0), memory("aimemory-b", 4)],
    });
    const created = await service.createAiMemory("新しいメモ");
    expect(created.id).toMatch(/^aimemory-/);
    expect(created.sortOrder).toBe(5);
    const insert = requests.find((r) => r.op === "insert");
    expect(insert?.payload).not.toHaveProperty("user_id");
  });

  it("starts the first memory at 0", async () => {
    const { service } = makeFake();
    expect((await service.createAiMemory("最初")).sortOrder).toBe(0);
  });

  it("refuses a blank or oversized memory before sending anything", async () => {
    const { service, requests } = makeFake();
    await expect(service.createAiMemory("  \n")).rejects.toMatchObject({
      field: "body",
      issue: "empty",
    });
    await expect(
      service.updateAiMemory(
        "aimemory-a",
        "a".repeat(AI_MEMORY_BODY_MAX_CHARS + 1),
      ),
    ).rejects.toBeInstanceOf(AiCustomizationValidationError);
    expect(requests).toEqual([]);
  });

  it("bumps updated_at on an edit", async () => {
    const { service, db } = makeFake({
      ai_memories: [memory("aimemory-a", 0)],
    });
    const updated = await service.updateAiMemory("aimemory-a", "直したメモ");
    expect(updated.body).toBe("直したメモ");
    expect(updated.updatedAt).not.toBe(T0);
    expect(db.ai_memories[0].updated_at).not.toBe(T0);
  });

  it("fails on an edit of a memory that is gone", async () => {
    const { service } = makeFake();
    await expect(
      service.updateAiMemory("aimemory-missing", "x"),
    ).rejects.toThrow("updateAiMemory (id=aimemory-missing) failed");
  });

  it("reorders by position and bumps every moved row", async () => {
    const { service, db } = makeFake({
      ai_memories: [
        memory("aimemory-a", 0),
        memory("aimemory-b", 1),
        memory("aimemory-c", 2),
      ],
    });
    await service.reorderAiMemories(["aimemory-c", "aimemory-a", "aimemory-b"]);
    expect((await service.fetchAiMemories()).map((m) => m.id)).toEqual([
      "aimemory-c",
      "aimemory-a",
      "aimemory-b",
    ]);
    for (const row of db.ai_memories) expect(row.updated_at).not.toBe(T0);
  });

  it("deletes physically", async () => {
    const { service, db } = makeFake({
      ai_memories: [memory("aimemory-a", 0), memory("aimemory-b", 1)],
    });
    await service.deleteAiMemory("aimemory-a");
    expect(db.ai_memories.map((r) => r.id)).toEqual(["aimemory-b"]);
  });
});

describe("Claude skills", () => {
  it("lists by slug", async () => {
    const { service } = makeFake({
      ai_skills: [skill("aiskill-2", "weekly-review"), skill("aiskill-1", "a")],
    });
    expect((await service.fetchAiSkills()).map((s) => s.slug)).toEqual([
      "a",
      "weekly-review",
    ]);
  });

  it("creates a skill with an aiskill- id and no user_id", async () => {
    const { service, requests } = makeFake();
    const created = await service.createAiSkill({
      slug: "weekly-review",
      description: "週次のふり返りをするときに使う",
      body: "# 手順",
    });
    expect(created.id).toMatch(/^aiskill-/);
    expect(created).toMatchObject({
      slug: "weekly-review",
      description: "週次のふり返りをするときに使う",
      body: "# 手順",
    });
    expect(requests.find((r) => r.op === "insert")?.payload).not.toHaveProperty(
      "user_id",
    );
  });

  it("refuses a bad slug or a multi-line description before sending", async () => {
    const { service, requests } = makeFake();
    await expect(
      service.createAiSkill({ slug: "Weekly", description: "d", body: "" }),
    ).rejects.toMatchObject({ field: "slug", issue: "badSlug" });
    await expect(
      service.updateAiSkill("aiskill-1", { description: "1 行目\n2 行目" }),
    ).rejects.toMatchObject({ field: "description", issue: "multiline" });
    expect(requests).toEqual([]);
  });

  it("turns a duplicate slug into `taken`", async () => {
    const { service } = makeFake({
      ai_skills: [skill("aiskill-1", "weekly-review")],
    });
    await expect(
      service.createAiSkill({
        slug: "weekly-review",
        description: "d",
        body: "",
      }),
    ).rejects.toMatchObject({ field: "slug", issue: "taken" });
  });

  it("turns a rename onto an existing slug into `taken` too", async () => {
    const { service } = makeFake({
      ai_skills: [skill("aiskill-1", "a"), skill("aiskill-2", "b")],
    });
    await expect(
      service.updateAiSkill("aiskill-2", { slug: "a" }),
    ).rejects.toMatchObject({ field: "slug", issue: "taken" });
  });

  it("keeps the plain wording for any other write error", async () => {
    const { service } = makeFake();
    await expect(
      service.updateAiSkill("aiskill-missing", { body: "x" }),
    ).rejects.toThrow("updateAiSkill (id=aiskill-missing) failed: PGRST116");
  });

  it("updates only the fields given and bumps updated_at", async () => {
    const { service, requests } = makeFake({
      ai_skills: [skill("aiskill-1", "weekly-review")],
    });
    const updated = await service.updateAiSkill("aiskill-1", {
      body: "新しい本文",
    });
    expect(updated.body).toBe("新しい本文");
    expect(updated.slug).toBe("weekly-review");
    const patch = requests.find((r) => r.op === "update")?.payload;
    expect(Object.keys(patch ?? {}).sort()).toEqual(["body", "updated_at"]);
  });

  it("deletes physically", async () => {
    const { service, db } = makeFake({
      ai_skills: [skill("aiskill-1", "a"), skill("aiskill-2", "b")],
    });
    await service.deleteAiSkill("aiskill-1");
    expect(db.ai_skills.map((r) => r.id)).toEqual(["aiskill-2"]);
  });
});
