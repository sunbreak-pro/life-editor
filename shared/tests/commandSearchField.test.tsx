import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommandSearchField } from "../src/components";

/*
 * CommandSearchField (#306) — header palette trigger. Verifies the wide field
 * shows placeholder + shortcut keycap, both the wide and narrow (icon) buttons
 * open the palette on click, and the accessible label is applied.
 */

describe("CommandSearchField", () => {
  it("renders placeholder, shortcut hint, and the a11y label", () => {
    render(
      <CommandSearchField
        onOpen={() => {}}
        placeholder="Search or run a command"
        label="Open command palette"
        shortcutHint="⌘K"
      />,
    );
    expect(screen.getByText("Search or run a command")).toBeTruthy();
    expect(screen.getByText("⌘K")).toBeTruthy();
    // Both the wide field and the narrow icon button carry the label.
    expect(screen.getAllByLabelText("Open command palette").length).toBe(2);
  });

  it("opens the palette when the field is clicked", () => {
    const onOpen = vi.fn();
    render(
      <CommandSearchField
        onOpen={onOpen}
        placeholder="Search"
        label="Open command palette"
      />,
    );
    fireEvent.click(screen.getAllByLabelText("Open command palette")[0]);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("omits the keycap when no shortcut hint is given", () => {
    render(
      <CommandSearchField
        onOpen={() => {}}
        placeholder="Search"
        label="Open command palette"
      />,
    );
    expect(screen.queryByText("⌘K")).toBeNull();
  });
});
