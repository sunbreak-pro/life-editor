import { describe, it, expect } from "vitest";
import { TOOLS } from "../src/tools.js";

/*
 * list_tasks' parent filter (#419). The schema IS the documentation for this
 * server's only caller — Claude Code reads it at connect time and picks
 * arguments from the names it finds. So a parameter whose name describes
 * something that no longer exists ("folder", retired in #225) is not cosmetic:
 * it is a wrong instruction, delivered every session.
 *
 * These pin the rename so it cannot silently drift back, and so the name stays
 * the SAME one create_task already uses for the same concept.
 */

const listTasks = TOOLS.find((t) => t.name === "list_tasks");
const createTask = TOOLS.find((t) => t.name === "create_task");

function props(tool: (typeof TOOLS)[number] | undefined) {
  return (tool?.inputSchema.properties ?? {}) as Record<string, unknown>;
}

describe("list_tasks parent filter (#419)", () => {
  it("exposes the filter as parent_id", () => {
    expect(props(listTasks)).toHaveProperty("parent_id");
  });

  it("no longer exposes the retired folder vocabulary", () => {
    expect(props(listTasks)).not.toHaveProperty("folder_id");
    expect(listTasks?.description ?? "").not.toMatch(/folder/i);
  });

  it("uses the same argument name create_task uses for the same concept", () => {
    expect(props(createTask)).toHaveProperty("parent_id");
  });
});
