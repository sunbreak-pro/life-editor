import { describe, it, expect } from "vitest";
import { useRef, useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Menu, MenuItem } from "../src/components";

/*
 * #1852 — the Connect tag row's "…" menu left `document.activeElement` on
 * <body> after Escape. <Menu> takes the focus on open (WAI-ARIA roving focus)
 * and never gave it back, so a keyboard user lost their place: the next Tab
 * restarted from the top of the page. Menu is shared, so this reached every
 * screen that draws one.
 */

/** Runs the pending rAF callback — that is when the first row is focused. */
async function afterFrame() {
  await act(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  });
}

function Host({ withAnchor = true }: { withAnchor?: boolean }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        open
      </button>
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        label="Actions"
        anchorRef={withAnchor ? triggerRef : undefined}
      >
        <MenuItem onSelect={() => setOpen(false)}>rename</MenuItem>
        <MenuItem onSelect={() => setOpen(false)}>delete</MenuItem>
      </Menu>
      <button type="button">after</button>
    </>
  );
}

/** The first row's BUTTON — `getByText` would hand back its inner span. */
function renameRow(): HTMLElement {
  return screen.getByRole("menuitem", { name: "rename" });
}

/** Opens the menu from the trigger and waits for the first row to take focus. */
async function openMenu(props?: { withAnchor?: boolean }) {
  render(<Host {...props} />);
  const trigger = screen.getByText("open");
  trigger.focus();
  fireEvent.click(trigger);
  await afterFrame();
  expect(document.activeElement).toBe(renameRow());
  return trigger;
}

describe("Menu — focus goes back to the trigger on close (#1852)", () => {
  it("returns focus to the trigger on Escape", async () => {
    const trigger = await openMenu();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("returns focus to the trigger when a row is picked", async () => {
    const trigger = await openMenu();

    fireEvent.click(renameRow());

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  // No anchorRef: a right-click menu points its ref at a row rather than at a
  // focusable control, so the fallback is whoever held the focus at open.
  it("falls back to the element that had focus when no anchorRef is given", async () => {
    const trigger = await openMenu({ withAnchor: false });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(document.activeElement).toBe(trigger);
  });

  // Tab closes the menu so the focus can move ON (the WAI-ARIA menu pattern,
  // and why the handler does not preventDefault). Pulling it back to the
  // trigger would make the key do the opposite of what it says.
  it("leaves focus alone when Tab closes the menu", async () => {
    const trigger = await openMenu();

    fireEvent.keyDown(renameRow(), { key: "Tab" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(document.activeElement).not.toBe(trigger);
  });

  // Escape mid-IME-composition cancels a conversion; it must not reach the
  // menu at all, so nothing closes and nothing moves.
  it("stays open, focus intact, on an IME Escape", async () => {
    await openMenu();

    fireEvent.keyDown(document, { key: "Escape", isComposing: true });

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(document.activeElement).toBe(renameRow());
  });
});
