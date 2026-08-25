// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import { balanceByRole } from "../src/utils/balanceByRole";

/*
 * #370 — the "[[" pool is concatenated per role (notes → dailies → todos), so
 * a plain slice(0, 8) gave every slot to notes and the newly-added todo
 * candidates never reached the menu.
 */

const t = (id: string, role: string) => ({ id, role });
const ids = (items: { id: string }[]): string[] => items.map((i) => i.id);

describe("balanceByRole (#370)", () => {
  it("gives every role a slot before any role gets a second one", () => {
    const pool = [
      t("n1", "note"),
      t("n2", "note"),
      t("n3", "note"),
      t("d1", "daily"),
      t("k1", "task"),
      t("k2", "task"),
    ];
    expect(ids(balanceByRole(pool, 4))).toEqual(["n1", "d1", "k1", "n2"]);
  });

  it("returns everything untouched when the pool fits", () => {
    const pool = [t("n1", "note"), t("k1", "task")];
    expect(ids(balanceByRole(pool, 8))).toEqual(["n1", "k1"]);
  });

  it("degrades to a plain slice for a single role", () => {
    const pool = [
      t("n1", "note"),
      t("n2", "note"),
      t("n3", "note"),
      t("n4", "note"),
    ];
    expect(ids(balanceByRole(pool, 2))).toEqual(["n1", "n2"]);
  });

  it("keeps filling from the remaining roles once one runs out", () => {
    const pool = [
      t("n1", "note"),
      t("n2", "note"),
      t("n3", "note"),
      t("n4", "note"),
      t("k1", "task"),
    ];
    // Round 1: n1, k1. Round 2: todo bucket is empty, so notes carry on.
    expect(ids(balanceByRole(pool, 4))).toEqual(["n1", "k1", "n2", "n3"]);
  });

  it("preserves first-seen role order as the priority order", () => {
    const pool = [t("k1", "task"), t("n1", "note"), t("k2", "task")];
    expect(ids(balanceByRole(pool, 2))).toEqual(["k1", "n1"]);
  });

  it("returns [] for a non-positive limit", () => {
    expect(balanceByRole([t("n1", "note")], 0)).toEqual([]);
  });
});
