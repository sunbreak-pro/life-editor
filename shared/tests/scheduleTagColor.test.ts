import { describe, it, expect } from "vitest";
import {
  buildItemTagColors,
  pickDisplayAssignment,
  readableInkOn,
  tagFaceStyle,
} from "../src/utils/scheduleTagColor";
import type { WikiTag, WikiTagAssignment } from "../src/types/wikiTagUnified";

/*
 * #1580 — which of an item's tags colours it on the calendar.
 *
 * The rule the Issue names is "the tag added first, unless the user says
 * otherwise", and the hard half is the first clause: `wiki_tag_assignments`
 * had no created_at until migration 0030, and `updated_at` cannot stand in for
 * it — reviving a soft-deleted assignment moves that value to now, which would
 * silently repaint the item in the colour of a tag that was added years later.
 * The default case below is what pins that.
 *
 * Pure functions, so nothing here needs a DOM or a Provider.
 */

const tag = (id: string, color: string | null): WikiTag => ({
  id,
  name: id,
  color,
  icon: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  isDeleted: false,
  deletedAt: null,
});

const assign = (
  id: string,
  itemId: string,
  tagId: string,
  createdAt: string,
  extra: Partial<WikiTagAssignment> = {},
): WikiTagAssignment => ({
  id,
  itemId,
  tagId,
  createdAt,
  updatedAt: createdAt,
  isDisplayColor: false,
  isDeleted: false,
  deletedAt: null,
  ...extra,
});

describe("pickDisplayAssignment — the default is the tag added first", () => {
  it("picks the earliest createdAt, whatever order the rows arrive in", () => {
    const rows = [
      assign("a3", "event-1", "tag-c", "2026-03-01T00:00:00.000Z"),
      assign("a1", "event-1", "tag-a", "2026-01-01T00:00:00.000Z"),
      assign("a2", "event-1", "tag-b", "2026-02-01T00:00:00.000Z"),
    ];
    expect(pickDisplayAssignment(rows, "event-1")?.tagId).toBe("tag-a");
  });

  /*
   * The reason 0030 adds a column instead of reusing `updated_at`. Here the
   * first-added tag is the LAST-touched row, which is exactly what happens
   * when an assignment is removed and put back.
   */
  it("does not fall for a revived assignment's updatedAt", () => {
    const rows = [
      assign("a1", "event-1", "tag-a", "2026-01-01T00:00:00.000Z", {
        updatedAt: "2026-09-01T00:00:00.000Z",
      }),
      assign("a2", "event-1", "tag-b", "2026-02-01T00:00:00.000Z"),
    ];
    expect(pickDisplayAssignment(rows, "event-1")?.tagId).toBe("tag-a");
  });

  it("breaks a same-timestamp tie by id, so the colour cannot flicker", () => {
    const same = "2026-01-01T00:00:00.000Z";
    const forward = [
      assign("a1", "event-1", "tag-a", same),
      assign("a2", "event-1", "tag-b", same),
    ];
    const reversed = [...forward].reverse();
    expect(pickDisplayAssignment(forward, "event-1")?.tagId).toBe("tag-a");
    expect(pickDisplayAssignment(reversed, "event-1")?.tagId).toBe("tag-a");
  });

  it("lets an explicit pick beat the earliest one", () => {
    const rows = [
      assign("a1", "event-1", "tag-a", "2026-01-01T00:00:00.000Z"),
      assign("a2", "event-1", "tag-b", "2026-02-01T00:00:00.000Z", {
        isDisplayColor: true,
      }),
    ];
    expect(pickDisplayAssignment(rows, "event-1")?.tagId).toBe("tag-b");
  });

  it("ignores other items' rows and deleted ones", () => {
    const rows = [
      assign("a0", "event-2", "tag-z", "2020-01-01T00:00:00.000Z"),
      assign("aX", "event-1", "tag-x", "2020-01-01T00:00:00.000Z", {
        isDeleted: true,
      }),
      assign("a1", "event-1", "tag-a", "2026-01-01T00:00:00.000Z"),
    ];
    expect(pickDisplayAssignment(rows, "event-1")?.tagId).toBe("tag-a");
  });

  it("returns null for an item with no tags", () => {
    expect(pickDisplayAssignment([], "event-1")).toBeNull();
  });
});

describe("readableInkOn — the title stays legible on any tag colour", () => {
  it("puts dark ink on a light fill and white on a dark one", () => {
    expect(readableInkOn("#fde68a")).toBe("#111827");
    expect(readableInkOn("#1e3a8a")).toBe("#ffffff");
  });

  /*
   * Why the WCAG luminance rather than the average of the channels: these two
   * have a nearly identical (r+g+b)/3 and land on opposite sides of readable.
   */
  it("tells apart two colours a naive average would not", () => {
    const green = "#22c55e";
    const blue = "#3b4fd8";
    const avg = (hex: string) =>
      (parseInt(hex.slice(1, 3), 16) +
        parseInt(hex.slice(3, 5), 16) +
        parseInt(hex.slice(5, 7), 16)) /
      3;
    expect(Math.abs(avg(green) - avg(blue))).toBeLessThan(20);
    expect(readableInkOn(green)).toBe("#111827");
    expect(readableInkOn(blue)).toBe("#ffffff");
  });

  it("accepts the 3-digit form", () => {
    expect(readableInkOn("#fff")).toBe("#111827");
    expect(readableInkOn("#000")).toBe("#ffffff");
  });

  it("gives up on anything that is not a hex", () => {
    // The caller then leaves the row on its variant colours rather than
    // painting a fill it cannot pick an ink for.
    expect(readableInkOn("rebeccapurple")).toBeNull();
    expect(readableInkOn("var(--x)")).toBeNull();
    expect(readableInkOn("")).toBeNull();
  });
});

describe("tagFaceStyle", () => {
  it("pairs the fill with its readable ink", () => {
    expect(tagFaceStyle("#1e3a8a")).toEqual({
      backgroundColor: "#1e3a8a",
      color: "#ffffff",
    });
  });

  it("is undefined for no colour and for an unreadable one", () => {
    expect(tagFaceStyle(null)).toBeUndefined();
    expect(tagFaceStyle(undefined)).toBeUndefined();
    expect(tagFaceStyle("chartreuse")).toBeUndefined();
  });
});

describe("buildItemTagColors — one pass over the whole assignment list", () => {
  const TAGS = [tag("tag-a", "#1e3a8a"), tag("tag-b", "#fde68a")];

  it("colours each item by the tag that speaks for it", () => {
    const rows = [
      assign("a1", "event-1", "tag-a", "2026-01-01T00:00:00.000Z"),
      assign("a2", "event-1", "tag-b", "2026-02-01T00:00:00.000Z"),
      assign("a3", "event-2", "tag-b", "2026-01-01T00:00:00.000Z"),
    ];
    const map = buildItemTagColors(rows, TAGS);
    expect(map.get("event-1")).toBe("#1e3a8a");
    expect(map.get("event-2")).toBe("#fde68a");
  });

  it("agrees with pickDisplayAssignment on an explicit pick", () => {
    const rows = [
      assign("a1", "event-1", "tag-a", "2026-01-01T00:00:00.000Z"),
      assign("a2", "event-1", "tag-b", "2026-02-01T00:00:00.000Z", {
        isDisplayColor: true,
      }),
    ];
    expect(buildItemTagColors(rows, TAGS).get("event-1")).toBe("#fde68a");
    expect(pickDisplayAssignment(rows, "event-1")?.tagId).toBe("tag-b");
  });

  it("leaves out an item whose chosen tag has no colour", () => {
    // NOT "find the next tag that does have one": the choice is which tag
    // speaks, and a colourless tag saying nothing is the variant colours.
    const rows = [
      assign("a1", "event-1", "tag-plain", "2026-01-01T00:00:00.000Z"),
      assign("a2", "event-1", "tag-a", "2026-02-01T00:00:00.000Z"),
    ];
    const map = buildItemTagColors(rows, [...TAGS, tag("tag-plain", null)]);
    expect(map.has("event-1")).toBe(false);
  });

  it("leaves out an item whose tag colour is not a hex", () => {
    const rows = [
      assign("a1", "event-1", "tag-odd", "2026-01-01T00:00:00.000Z"),
    ];
    const map = buildItemTagColors(rows, [tag("tag-odd", "papayawhip")]);
    expect(map.has("event-1")).toBe(false);
  });

  it("ignores deleted assignments and deleted tags", () => {
    const rows = [
      assign("a1", "event-1", "tag-a", "2026-01-01T00:00:00.000Z", {
        isDeleted: true,
      }),
      assign("a2", "event-1", "tag-b", "2026-02-01T00:00:00.000Z"),
    ];
    expect(buildItemTagColors(rows, TAGS).get("event-1")).toBe("#fde68a");

    const deletedTag = { ...tag("tag-b", "#fde68a"), isDeleted: true };
    expect(buildItemTagColors(rows, [deletedTag]).has("event-1")).toBe(false);
  });

  it("is empty when no tag carries a colour", () => {
    const rows = [assign("a1", "event-1", "tag-a", "2026-01-01T00:00:00.000Z")];
    expect(buildItemTagColors(rows, [tag("tag-a", null)]).size).toBe(0);
  });
});
