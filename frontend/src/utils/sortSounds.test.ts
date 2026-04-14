import { describe, it, expect } from "vitest";
import { sortSounds, type SortableSound } from "./sortSounds";

const sounds: SortableSound[] = [
  { id: "s1", label: "Cello", isCustom: false },
  { id: "s2", label: "Alpha", isCustom: true },
  { id: "s3", label: "Bass", isCustom: false },
];

const noOp = () => undefined;

describe("sortSounds", () => {
  it("returns items unchanged in default mode regardless of direction", () => {
    const asc = sortSounds(sounds, "default", noOp, "asc");
    const desc = sortSounds(sounds, "default", noOp, "desc");
    expect(asc.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
    expect(desc.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("sorts by name ascending (A-Z)", () => {
    const result = sortSounds(sounds, "name", noOp, "asc");
    expect(result.map((s) => s.label)).toEqual(["Alpha", "Bass", "Cello"]);
  });

  it("sorts by name descending (Z-A)", () => {
    const result = sortSounds(sounds, "name", noOp, "desc");
    expect(result.map((s) => s.label)).toEqual(["Cello", "Bass", "Alpha"]);
  });

  it("uses getDisplayName when available", () => {
    const getName = (id: string) => (id === "s1" ? "AAA" : undefined);
    const result = sortSounds(sounds, "name", getName, "asc");
    expect(result[0].id).toBe("s1"); // "AAA" sorts first
  });

  it("sorts custom-first ascending", () => {
    const result = sortSounds(sounds, "custom-first", noOp, "asc");
    expect(result.map((s) => s.id)).toEqual(["s2", "s1", "s3"]);
  });

  it("sorts custom-first descending (preset first)", () => {
    const result = sortSounds(sounds, "custom-first", noOp, "desc");
    expect(result.map((s) => s.id)).toEqual(["s3", "s1", "s2"]);
  });

  it("defaults direction to asc when omitted", () => {
    const result = sortSounds(sounds, "name", noOp);
    expect(result.map((s) => s.label)).toEqual(["Alpha", "Bass", "Cello"]);
  });
});
