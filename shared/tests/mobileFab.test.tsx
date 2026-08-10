import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileFab } from "../src/components";

/*
 * #632 — the narrow layout's floating "+" had two placements: Schedule's
 * `fixed bottom-6 right-6` and Notes' `absolute bottom-5 right-5`. The fixed
 * one is the bug: mobile Chrome resolves `fixed` against the LAYOUT viewport
 * (URL-bar-hidden height) while the shell is `h-[100svh]`, so the button drifts
 * out of view as the URL bar collapses. These cases pin the single definition
 * both hosts now share — the containing block above all, since that is what
 * actually moved for Schedule.
 *
 * What these cases can NOT pin: whether a host's anchor really spans the
 * section box. That is a layout property of the host's chain (definite vs auto
 * height) and jsdom has no layout at all, so it needs a real browser. Notes is
 * currently the host that fails it — see MobileFab's HOST CONTRACT.
 */

describe("MobileFab (#632)", () => {
  it("exposes the host's label on a button", () => {
    render(<MobileFab onClick={() => {}} label="Add event" />);
    expect(
      screen.getByRole("button", { name: "Add event" }),
    ).toBeInTheDocument();
  });

  it("fires onClick when tapped", () => {
    const onClick = vi.fn();
    render(<MobileFab onClick={onClick} label="Add note" />);
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("anchors to its ancestor, never to the viewport", () => {
    render(<MobileFab onClick={() => {}} label="Add" />);
    const fab = screen.getByRole("button", { name: "Add" });
    expect(fab.className).toContain("absolute");
    // The whole point of the issue: `fixed` is what made the position drift.
    expect(fab.className).not.toContain("fixed");
  });

  it("keeps the offset that the hosts' pb-24 clearance is sized for", () => {
    render(<MobileFab onClick={() => {}} label="Add" />);
    const fab = screen.getByRole("button", { name: "Add" });
    // 24px offset + 56px button = 80px occluded strip; hosts pad by 96px (#509).
    expect(fab.className).toContain("bottom-6");
    expect(fab.className).toContain("right-6");
    expect(fab.className).toContain("size-14");
    // Re-applying the inset here would push the button off its anchor — the
    // bottom tab bar already owns the home-indicator strip.
    expect(fab.className).not.toContain("safe-area-inset-bottom");
  });

  it("lets a host swap the glyph without touching placement", () => {
    render(
      <MobileFab
        onClick={() => {}}
        label="Add"
        icon={<span data-testid="glyph">*</span>}
      />,
    );
    expect(screen.getByTestId("glyph")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" }).className).toContain(
      "absolute",
    );
  });
});
