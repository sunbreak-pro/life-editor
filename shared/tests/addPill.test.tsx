import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddPill } from "../src/components";

/*
 * #1034 — the accent "+" pill that starts a create flow from a list header.
 *
 * It existed as two byte-identical inline `<button>` blocks (NotesView and
 * KanbanBoardSurface) until Schedule needed a third. These cases pin the one
 * definition all three now share.
 *
 * The token assertions are not decoration: the Issue's DoD is 「同一の部品 /
 * トークンを使っていること（色のハードコード無し）」, and a copied class string
 * drifting to a literal colour is exactly the failure that neither the build
 * nor any render catches.
 *
 * What these cases can NOT pin: that the pill lands at the right end of its
 * host's header row. That is the host's flex row, and jsdom has no layout.
 */

describe("AddPill (#1034)", () => {
  it("exposes the host's label as the button's name", () => {
    render(<AddPill onClick={() => {}} label="Add note" />);
    expect(
      screen.getByRole("button", { name: "Add note" }),
    ).toBeInTheDocument();
  });

  it("fires onClick once when tapped", () => {
    const onClick = vi.fn();
    render(<AddPill onClick={onClick} label="Add" />);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is type=button", () => {
    // Two of the three hosts sit inside forms' ancestry; a bare <button>
    // defaults to submit and would reload the surface instead of adding a row.
    render(<AddPill onClick={() => {}} label="Add" />);
    expect(screen.getByRole("button", { name: "Add" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("paints itself from lumen tokens only", () => {
    render(<AddPill onClick={() => {}} label="Add" />);
    const cls = screen.getByRole("button", { name: "Add" }).className;
    expect(cls).toContain("bg-lumen-accent");
    expect(cls).toContain("text-lumen-on-accent");
    expect(cls).toContain("shadow-lumen-sm");
    expect(cls).toContain("focus-visible:ring-lumen-accent");
    // No literal colour, and no background that is not a lumen token.
    expect(cls).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|bg-(?!lumen)/);
  });

  it("draws a plus by default and lets a host swap the glyph", () => {
    const { unmount } = render(<AddPill onClick={() => {}} label="Add" />);
    // lucide renders an <svg>; the label is the only text, so the glyph is
    // whatever else the button contains.
    expect(
      screen.getByRole("button", { name: "Add" }).querySelector("svg"),
    ).not.toBeNull();
    unmount();

    render(
      <AddPill
        onClick={() => {}}
        label="Add"
        icon={<span data-testid="glyph" />}
      />,
    );
    expect(screen.getByTestId("glyph")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add" }).querySelector("svg"),
    ).toBeNull();
  });

  it("lets a host add classes without losing its own", () => {
    render(<AddPill onClick={() => {}} label="Add" className="ml-auto" />);
    const cls = screen.getByRole("button", { name: "Add" }).className;
    expect(cls).toContain("ml-auto");
    expect(cls).toContain("bg-lumen-accent");
  });
});
