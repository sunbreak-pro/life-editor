import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { useDialogA11y } from "@life-editor/shared";
import { OtherNotesList } from "../src/notes/OtherNotesPanel";

/*
 * #2096 — on narrow, "Other items" replaces the list INSIDE the MobileDrawer.
 * The drawer's Esc comes from useDialogA11y, which listens on document in the
 * capture phase, so a keydown handler on the view itself is reached too late:
 * one Esc used to close the whole drawer. notesView.test.tsx stubs the drawer,
 * so the clash is pinned here against the real hook, standing in for the
 * drawer's panel.
 */

function Drawer({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useDialogA11y<HTMLDivElement>({ open: true, onClose });
  return (
    <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1}>
      {children}
    </div>
  );
}

/*
 * The drawer is already open when the view appears — the user opened it, then
 * pressed "Other items". The order matters: layers stack in effect order, and
 * mounting both in one render would run the child's effect (the view) first
 * and put the drawer on top, which is not a state the app can reach.
 */
function renderInDrawer() {
  const onClose = vi.fn();
  const onDismiss = vi.fn();
  const tree = (showOthers: boolean) => (
    <Drawer onClose={onClose}>
      {showOthers && (
        <OtherNotesList
          id="others"
          title="Other items (2)"
          dismissLabel="Back"
          variant="inline"
          onDismiss={onDismiss}
        >
          <li>
            <button type="button">Note 01</button>
          </li>
        </OtherNotesList>
      )}
    </Drawer>
  );
  const { rerender } = render(tree(false));
  rerender(tree(true));
  return { onClose, onDismiss };
}

describe("OtherNotesList — Esc inside the drawer (#2096)", () => {
  it("goes back to the list and leaves the drawer open", () => {
    const { onClose, onDismiss } = renderInDrawer();

    fireEvent.keyDown(screen.getByRole("button", { name: "Back" }), {
      key: "Escape",
    });

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("takes the Esc from a row as well as from the back button", () => {
    const { onClose, onDismiss } = renderInDrawer();

    fireEvent.keyDown(screen.getByRole("button", { name: "Note 01" }), {
      key: "Escape",
    });

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("leaves Esc to the drawer while an IME is composing", () => {
    const { onClose, onDismiss } = renderInDrawer();

    fireEvent.keyDown(screen.getByRole("button", { name: "Back" }), {
      key: "Escape",
      isComposing: true,
    });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
