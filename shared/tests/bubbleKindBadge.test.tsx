import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BubbleKindBadge, type BubbleKind } from "../src/components";

/*
 * #2564 — the schedule bubble's kind capsule: filled with the kind's colour
 * and drawn without an icon, unlike ItemRoleBadge (the tag hub's outlined
 * chip with an icon, which has to stay as it is).
 */
describe("BubbleKindBadge (#2564)", () => {
  it.each<[BubbleKind, string, string]>([
    ["event", "bg-lumen-chip-event-bg", "text-lumen-chip-event-fg"],
    ["task", "bg-lumen-chip-task-bg", "text-lumen-chip-task-fg"],
    ["routine", "bg-lumen-chip-routine-bg", "text-lumen-chip-routine-fg"],
    ["holiday", "bg-lumen-danger-subtle", "text-lumen-danger"],
  ])(
    "fills a %s badge with that kind's pair and draws no icon",
    (kind, bg, fg) => {
      const { container } = render(
        <BubbleKindBadge kind={kind} label="Kind" />,
      );
      const badge = screen.getByText("Kind");
      expect(badge).toHaveAttribute("data-bubble-kind", kind);
      expect(badge.className).toContain(bg);
      expect(badge.className).toContain(fg);
      // Filled, not outlined: no border of its own.
      expect(badge.className).not.toMatch(/\bborder\b/);
      expect(container.querySelector("svg")).toBeNull();
    },
  );

  it("gives each kind a different face", () => {
    const faces = (["event", "task", "routine", "holiday"] as const).map(
      (kind) => {
        const { unmount } = render(
          <BubbleKindBadge kind={kind} label={kind} />,
        );
        const face = screen
          .getByText(kind)
          .className.split(" ")
          .find((c) => c.startsWith("bg-"));
        unmount();
        return face;
      },
    );
    expect(new Set(faces).size).toBe(4);
  });

  it("keeps the caller's extra classes", () => {
    render(
      <BubbleKindBadge kind="event" label="予定" className="self-start" />,
    );
    expect(screen.getByText("予定").className).toContain("self-start");
  });
});
