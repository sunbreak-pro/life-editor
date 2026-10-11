import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseStub,
  fromTables,
  type QueryCall,
  type StubRow,
  type SupabaseStub,
} from "./supabaseStub.js";
import { AI_CUSTOMIZATION_TOOLS } from "../src/tools/aiCustomization.js";

let stub: SupabaseStub = createSupabaseStub();
vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
}));

// Dynamic on purpose: a static import would be hoisted above vi.mock.
const {
  addAiMemory,
  createAiSkill,
  getAiRules,
  getAiSkill,
  listAiMemories,
  listAiSkills,
  updateAiMemory,
  updateAiSkill,
} = await import("../src/handlers/aiCustomizationHandlers.js");

/*
 * The Claude customization tools (#2121). Two things are pinned:
 *
 * 1. Whose rows. The stub signs in as "user-under-test" and the fixture holds
 *    another user's rows next to it. RLS is the real guard; these tests check
 *    the second one — every query filters on the signed-in user and every
 *    insert names it — so a read never hands Claude someone else's memory and
 *    a write never lands on someone else's row.
 * 2. What Claude can do. Memories are added / updated one at a time, skills
 *    created / updated, and nothing deletes or writes the rules.
 */

const ME = "user-under-test";
const OTHER = "someone-else";

const memory = (id: string, user: string, sort: number): StubRow => ({
  id,
  user_id: user,
  body: `body:${id}`,
  sort_order: sort,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
});

const skill = (id: string, user: string, slug: string): StubRow => ({
  id,
  user_id: user,
  slug,
  description: `description:${slug}`,
  body: `body:${slug}`,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
});

const TABLES = {
  ai_rules: [
    {
      user_id: OTHER,
      body: "other's rules",
      updated_at: "2026-10-02T00:00:00Z",
    },
    { user_id: ME, body: "my rules", updated_at: "2026-10-03T00:00:00Z" },
  ],
  ai_memories: [
    memory("aimemory-o1", OTHER, 9),
    memory("aimemory-m2", ME, 1),
    memory("aimemory-m1", ME, 0),
  ],
  ai_skills: [
    skill("aiskill-o1", OTHER, "deploy"),
    skill("aiskill-m1", ME, "review"),
    skill("aiskill-m2", ME, "deploy-check"),
  ],
};

/**
 * Reads run against TABLES; a write's returned row is the written values
 * merged over the row it matched (the in-memory layer never applies writes).
 */
function install(): void {
  const read = fromTables(TABLES);
  stub = createSupabaseStub((call: QueryCall) => {
    if (call.op === "select") return read(call);
    if (call.op === "insert") {
      return { created_at: "now", updated_at: "now", ...call.values };
    }
    const target = read({
      ...call,
      op: "select",
      single: true,
    }) as StubRow | null;
    return target ? { ...target, ...call.values } : null;
  });
}

beforeEach(install);

function everyQueryIsMine(): void {
  expect(stub.calls.length).toBeGreaterThan(0);
  for (const call of stub.calls) {
    if (call.op === "insert") expect(call.values?.user_id).toBe(ME);
    else expect(call.filters.user_id).toBe(ME);
  }
}

describe("reads stay inside the signed-in user's rows", () => {
  it("get_ai_rules returns my rules, not another user's", async () => {
    expect(await getAiRules()).toEqual({
      body: "my rules",
      updatedAt: "2026-10-03T00:00:00Z",
    });
    everyQueryIsMine();
  });

  it("get_ai_rules answers an empty body when nothing is saved, and writes nothing", async () => {
    stub = createSupabaseStub(fromTables({ ai_rules: [] }));
    expect(await getAiRules()).toEqual({ body: "", updatedAt: null });
    expect(stub.writes()).toEqual([]);
  });

  it("list_ai_memories lists mine in sort order", async () => {
    const { memories } = await listAiMemories();
    expect(memories.map((m) => m.id)).toEqual(["aimemory-m1", "aimemory-m2"]);
    everyQueryIsMine();
  });

  it("list_ai_skills lists mine by name, without bodies", async () => {
    const { skills } = await listAiSkills();
    expect(skills.map((s) => s.slug)).toEqual(["deploy-check", "review"]);
    expect(skills[0]).not.toHaveProperty("body");
    everyQueryIsMine();
  });

  it("get_ai_skill does not find another user's skill of that name", async () => {
    await expect(getAiSkill({ slug: "deploy" })).rejects.toThrow(
      "Skill not found: deploy",
    );
    everyQueryIsMine();
  });

  it("get_ai_skill returns the body", async () => {
    const found = await getAiSkill({ slug: "review" });
    expect(found).toMatchObject({ id: "aiskill-m1", body: "body:review" });
  });
});

describe("memories", () => {
  it("add_ai_memory appends after my last item, as me", async () => {
    const added = await addAiMemory({ body: "remember this" });
    const [insert] = stub.writes();
    expect(insert.table).toBe("ai_memories");
    expect(insert.values).toMatchObject({
      user_id: ME,
      body: "remember this",
      // My max is 1; another user's 9 must not push mine to 10.
      sort_order: 2,
    });
    expect(String(insert.values?.id)).toMatch(/^aimemory-[0-9a-f-]{36}$/);
    expect(added.body).toBe("remember this");
    everyQueryIsMine();
  });

  it("add_ai_memory starts at 0 on an empty list", async () => {
    stub = createSupabaseStub((call) =>
      call.op === "select" ? null : { ...call.values },
    );
    await addAiMemory({ body: "first" });
    expect(stub.writes()[0].values?.sort_order).toBe(0);
  });

  it("add_ai_memory refuses a blank or oversized item before writing", async () => {
    await expect(addAiMemory({ body: "  " })).rejects.toThrow(
      "body must not be empty",
    );
    await expect(addAiMemory({ body: "x".repeat(1_001) })).rejects.toThrow(
      "body is longer than 1000 characters",
    );
    expect(stub.calls).toEqual([]);
  });

  it("update_ai_memory rewrites only my row", async () => {
    const updated = await updateAiMemory({ id: "aimemory-m1", body: "new" });
    const [update] = stub.writes();
    expect(update.filters).toEqual({ id: "aimemory-m1", user_id: ME });
    expect(update.values).toMatchObject({ body: "new" });
    expect(update.values?.updated_at).toEqual(expect.any(String));
    expect(updated.body).toBe("new");
  });

  it("update_ai_memory on another user's id reports not found", async () => {
    await expect(
      updateAiMemory({ id: "aimemory-o1", body: "hijack" }),
    ).rejects.toThrow("Memory not found: aimemory-o1");
    everyQueryIsMine();
  });
});

describe("skills", () => {
  it("create_ai_skill inserts as me", async () => {
    const created = await createAiSkill({
      slug: "write-tests",
      description: "How to write tests here",
      body: "# Steps",
    });
    const [insert] = stub.writes();
    expect(insert.table).toBe("ai_skills");
    expect(insert.values).toMatchObject({
      user_id: ME,
      slug: "write-tests",
      description: "How to write tests here",
      body: "# Steps",
    });
    expect(String(insert.values?.id)).toMatch(/^aiskill-[0-9a-f-]{36}$/);
    expect(created.slug).toBe("write-tests");
    everyQueryIsMine();
  });

  it("create_ai_skill defaults the body to empty", async () => {
    await createAiSkill({ slug: "empty-body", description: "d" });
    expect(stub.writes()[0].values?.body).toBe("");
  });

  it("create_ai_skill may reuse a name only another user has", async () => {
    await createAiSkill({ slug: "deploy", description: "mine now" });
    expect(stub.writes()).toHaveLength(1);
  });

  it("create_ai_skill refuses a name I already use", async () => {
    await expect(
      createAiSkill({ slug: "review", description: "again" }),
    ).rejects.toThrow('A skill named "review" already exists');
    expect(stub.writes()).toEqual([]);
  });

  it.each([
    ["Bad-Name", "slug must be kebab-case"],
    ["con", "slug must be kebab-case"],
    ["../escape", "slug must be kebab-case"],
    ["x".repeat(65), "slug is longer than 64 characters"],
  ])("create_ai_skill refuses the name %s", async (slug, message) => {
    await expect(createAiSkill({ slug, description: "d" })).rejects.toThrow(
      message,
    );
    expect(stub.calls).toEqual([]);
  });

  it("create_ai_skill refuses a multi-line description", async () => {
    await expect(
      createAiSkill({ slug: "ok", description: "two\nlines" }),
    ).rejects.toThrow("description must be a single line");
  });

  it("update_ai_skill patches only the given fields of my skill", async () => {
    const updated = await updateAiSkill({ slug: "review", body: "v2" });
    const [update] = stub.writes();
    expect(update.filters).toEqual({ id: "aiskill-m1", user_id: ME });
    expect(Object.keys(update.values ?? {}).sort()).toEqual([
      "body",
      "updated_at",
    ]);
    expect(updated.body).toBe("v2");
    everyQueryIsMine();
  });

  it("update_ai_skill renames, and refuses a name already mine", async () => {
    await updateAiSkill({ slug: "review", new_slug: "code-review" });
    expect(stub.writes()[0].values?.slug).toBe("code-review");

    install();
    await expect(
      updateAiSkill({ slug: "review", new_slug: "deploy-check" }),
    ).rejects.toThrow('A skill named "deploy-check" already exists');
    expect(stub.writes()).toEqual([]);
  });

  it("update_ai_skill cannot reach another user's skill", async () => {
    await expect(
      updateAiSkill({ slug: "deploy", body: "hijack" }),
    ).rejects.toThrow("Skill not found: deploy");
    expect(stub.writes()).toEqual([]);
  });

  it("update_ai_skill with nothing to change is refused", async () => {
    await expect(updateAiSkill({ slug: "review" })).rejects.toThrow(
      "nothing to change",
    );
  });
});

describe("the tool surface", () => {
  it("offers no delete and no rules write", () => {
    const names = AI_CUSTOMIZATION_TOOLS.map((t) => t.name);
    expect(names).toEqual([
      "get_ai_rules",
      "list_ai_memories",
      "add_ai_memory",
      "update_ai_memory",
      "list_ai_skills",
      "get_ai_skill",
      "create_ai_skill",
      "update_ai_skill",
    ]);
    for (const name of names) expect(name).not.toMatch(/delete|remove/);
  });
});
