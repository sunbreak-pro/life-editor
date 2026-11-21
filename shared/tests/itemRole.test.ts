// @vitest-environment node (this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  ITEM_ROLE_ORDER,
  itemRoleLabel,
  resolveItemRole,
  type ItemRoleLabels,
} from "../src/components/items/itemRole";

const LABELS: ItemRoleLabels = {
  task: "Todo",
  event: "Event",
  note: "Note",
  daily: "Daily",
  unknown: "Other",
};

/*
 * Tagging a table in a note was removed in #2761, but `items_meta_role_check`
 * still admits `table`, so rows written before then can still arrive. They
 * must fall through to the neutral fallback, not to a kind of their own.
 */
describe("itemRole — roles outside the designed set", () => {
  it("lists only the four user-facing kinds", () => {
    expect(ITEM_ROLE_ORDER).toEqual(["task", "event", "note", "daily"]);
  });

  it("resolves a leftover table row to the unknown kind", () => {
    expect(resolveItemRole("table")).toBeNull();
    expect(itemRoleLabel("table", LABELS)).toBe("Other");
  });

  it("still names the designed kinds", () => {
    expect(itemRoleLabel("note", LABELS)).toBe("Note");
    expect(itemRoleLabel(null, LABELS)).toBe("Other");
  });
});
