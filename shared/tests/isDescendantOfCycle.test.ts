// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import { isDescendantOf } from "../src/utils/getDescendantTodos";
import type { NoteNode } from "../src/types/note";

/*
 * H1 regression net (KI-016 sibling). `isDescendantOf` previously had NO
 * visited guard; a parent_id cycle (A<->B) or self-reference (A->A) made the
 * BFS push the same node forever -> main-thread freeze / OOM on every drag.
 * These inputs WOULD hang the pre-fix code; vitest's default per-test timeout
 * (5s) turns any reintroduced infinite loop into a hard test failure rather
 * than a hung suite.
 *
 * The suite used to reach the function through the re-export shim in
 * useNoteTreeMovement; that hook was deleted with the rest of the tree-movement
 * chain (#1156), so it now imports the real home directly. The cases are the
 * ones getDescendantTodos.test.ts does NOT carry (self-reference, 2-cycle,
 * 3-cycle), which is why the file survived the sweep.
 */

function note(id: string, parentId: string | null): NoteNode {
  return {
    id,
    type: "note",
    title: id,
    content: "",
    parentId,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("isDescendantOf — cycle safety (H1 / KI-016)", () => {
  it("self-reference A->A terminates and does not loop", () => {
    const nodes = [note("A", "A")];
    // A is its own parent. childId "X" is unreachable -> must return false
    // in finite time (pre-fix: infinite push of A).
    expect(isDescendantOf("A", "X", nodes)).toBe(false);
  });

  it("2-node cycle A<->B terminates", () => {
    const nodes = [note("A", "B"), note("B", "A")];
    // Searching for an absent node inside a 2-cycle: pre-fix this looped
    // forever (A pushes B, B pushes A, ...). Must terminate as false.
    expect(isDescendantOf("A", "Z", nodes)).toBe(false);
  });

  it("2-node cycle still finds the directly-reachable child (target check before guard)", () => {
    const nodes = [note("A", "B"), note("B", "A")];
    // A's children include B (B.parentId === "A"). Even though A<->B is a
    // cycle, the target match happens BEFORE the visited guard so B is
    // found immediately.
    expect(isDescendantOf("A", "B", nodes)).toBe(true);
  });

  it("longer cycle A->B->C->A terminates for an absent target", () => {
    const nodes = [note("A", "C"), note("B", "A"), note("C", "B")];
    expect(isDescendantOf("A", "missing", nodes)).toBe(false);
  });

  it("acyclic tree still resolves descendants correctly", () => {
    const nodes = [
      note("root", null),
      note("child", "root"),
      note("grandchild", "child"),
    ];
    expect(isDescendantOf("root", "grandchild", nodes)).toBe(true);
    expect(isDescendantOf("child", "root", nodes)).toBe(false);
    expect(isDescendantOf("root", "nope", nodes)).toBe(false);
  });
});
