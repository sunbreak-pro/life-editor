import { describe, it, expect } from "vitest";
import { TOOLS } from "../src/tools.js";

/*
 * list_todos' parent filter (#419). The schema IS the documentation for this
 * server's only caller — Claude Code reads it at connect time and picks
 * arguments from the names it finds. So a parameter whose name describes
 * something that no longer exists ("folder", retired in #225) is not cosmetic:
 * it is a wrong instruction, delivered every session.
 *
 * These pin the rename so it cannot silently drift back, and so the name stays
 * the SAME one create_todo already uses for the same concept.
 */

const listTodos = TOOLS.find((t) => t.name === "list_todos");
const createTodo = TOOLS.find((t) => t.name === "create_todo");

function props(tool: (typeof TOOLS)[number] | undefined) {
  return (tool?.inputSchema.properties ?? {}) as Record<string, unknown>;
}

describe("list_todos parent filter (#419)", () => {
  it("exposes the filter as parent_id", () => {
    expect(props(listTodos)).toHaveProperty("parent_id");
  });

  it("no longer exposes the retired folder vocabulary", () => {
    expect(props(listTodos)).not.toHaveProperty("folder_id");
    expect(listTodos?.description ?? "").not.toMatch(/folder/i);
  });

  it("uses the same argument name create_todo uses for the same concept", () => {
    expect(props(createTodo)).toHaveProperty("parent_id");
  });
});
