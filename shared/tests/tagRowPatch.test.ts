// @vitest-environment node (this suite touches no DOM)
import { describe, it, expect } from "vitest";
import { tagRowPatch, NO_EDITS } from "../src/components";

/*
 * The draft model behind the tag editor's save button (#715).
 *
 * It was covered only through the tag edit modal's suites until #1643 retired
 * that panel, which would have left the repo's one answer to "what would one
 * press write" untested. It is a pure function over three fields, so it gets a
 * suite of its own rather than being re-covered through whichever screen
 * happens to host the editor next.
 *
 * The rule the whole thing exists for: dirty state and the payload come from
 * THIS function, so the save button can never enable for a change it then
 * declines to send.
 */

const TAG = { name: "Work", color: null, icon: null };

describe("tagRowPatch", () => {
  it("writes nothing for a tag nobody has typed against", () => {
    expect(tagRowPatch(TAG, NO_EDITS)).toEqual({});
    expect(tagRowPatch(TAG)).toEqual({});
  });

  it("carries only the fields that actually moved", () => {
    expect(tagRowPatch(TAG, { name: "Work log" })).toEqual({
      name: "Work log",
    });
    expect(tagRowPatch(TAG, { color: "#2563eb" })).toEqual({
      color: "#2563eb",
    });
    expect(tagRowPatch(TAG, { icon: "Code" })).toEqual({ icon: "Code" });
  });

  it("drops an edit that types the stored value back in", () => {
    // Otherwise the button stays lit after an undo-by-retyping, and pressing it
    // writes a patch that changes nothing.
    expect(tagRowPatch(TAG, { name: "Work" })).toEqual({});
    expect(
      tagRowPatch({ ...TAG, color: "#2563eb" }, { color: "#2563eb" }),
    ).toEqual({});
  });

  it("trims the name, and refuses a blank one", () => {
    // A blank field is a normal mid-typing state, not a rename — the editor
    // puts the stored name back on blur rather than saving an unnamed tag.
    expect(tagRowPatch(TAG, { name: "  Work log  " })).toEqual({
      name: "Work log",
    });
    expect(tagRowPatch(TAG, { name: "   " })).toEqual({});
    expect(tagRowPatch(TAG, { name: "" })).toEqual({});
  });

  it("treats clearing the colour or the icon as a change worth writing", () => {
    // `null` is a value here, not "no edit": it is how "use the default" is
    // said, and an `undefined`-style skip would make the Default button dead.
    expect(tagRowPatch({ ...TAG, color: "#2563eb" }, { color: null })).toEqual({
      color: null,
    });
    expect(tagRowPatch({ ...TAG, icon: "Code" }, { icon: null })).toEqual({
      icon: null,
    });
  });

  it("collects every moved field into ONE patch", () => {
    expect(
      tagRowPatch(TAG, { name: "Work log", color: "#2563eb", icon: "Code" }),
    ).toEqual({ name: "Work log", color: "#2563eb", icon: "Code" });
  });
});
