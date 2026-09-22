import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ConfirmDialog,
  RightSidebar,
  RightSidebarToggle,
  SegmentedControl,
  MobileDrawer,
  UndoRedoButtons,
} from "../src/components";
import { RightSidebarProvider } from "../src/context";

/*
 * #1512 — the 44px touch floor on the SHARED mobile chrome.
 *
 * The audit that filed the issue measured `getBoundingClientRect()` at 390px
 * width. jsdom has no layout (CLAUDE.md §7.1), so nothing here can re-measure
 * that: every assertion pins the CLASS CONTRACT that produces the size, which
 * is what the rest of the repo's sizing guards do (segmentedControl.test.tsx
 * says so in as many words, and web/tests/taskListCheckboxSize.test.ts is the
 * same shape).
 *
 * The per-section rows the issue also lists — the briefing mood stars, the
 * schedule move buttons, the settings cards, the trash actions — are NOT here.
 * They belong to their section lanes; this file covers only the parts every
 * section shares.
 *
 * Two floors, because the components divide into two kinds:
 *   `min-h-11 min-w-11`            — the control renders ONLY on narrow.
 *   `max-md:min-h-11 …`            — one component draws both the Desktop and
 *                                    the narrow instance, so the floor has to
 *                                    be conditional or Desktop grows with it.
 * `min-*` and never `h-11`, because `cn` is a plain string join: two utilities
 * for one property are settled by Tailwind's emit order, not by call order
 * (rules/frontend.md §Gotchas, #830).
 */

function renderToggle(variant: "panel" | "hamburger") {
  return render(
    <RightSidebarProvider>
      <RightSidebarToggle
        variant={variant}
        openLabel="Open details"
        closeLabel="Hide details"
      />
      <RightSidebar
        title="Details"
        emptyLabel="Nothing selected yet"
        resizeLabel="Resize details panel"
      />
    </RightSidebarProvider>,
  );
}

describe("#1512 — shared narrow chrome meets the 44px touch floor", () => {
  it("floors the drawer hamburger in BOTH directions", () => {
    renderToggle("hamburger");
    const btn = screen.getByRole("button", { name: "Open details" });
    expect(btn).toHaveClass("min-h-11");
    // The half the old TAP_TARGET_TALL could not buy: its `inset-x-0` held the
    // hit area to the control's own width, so the target stayed 36px wide.
    expect(btn).toHaveClass("min-w-11");
    // And the pseudo-element is gone rather than left doubling the box.
    expect(btn).not.toHaveClass("after:h-11");
  });

  it("leaves the DESKTOP panel toggle at its mouse size", () => {
    renderToggle("panel");
    const btn = screen.getByRole("button", { name: "Open details" });
    expect(btn).toHaveClass("h-7", "w-7");
    expect(btn).not.toHaveClass("min-h-11");
  });

  it("floors the mobile drawer's close button", () => {
    render(
      <RightSidebarProvider>
        <RightSidebarToggle
          variant="hamburger"
          openLabel="Open details"
          closeLabel="Hide details"
        />
        <MobileDrawer
          title="Details"
          closeLabel="Close details"
          emptyLabel="Nothing selected yet"
        />
      </RightSidebarProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    // Unconditional: this button only exists when a caller passes closeLabel +
    // onClose, and since #1284 only <MobileDrawer> does.
    const close = screen.getByRole("button", { name: "Close details" });
    expect(close).toHaveClass("min-h-11", "min-w-11");
    expect(close).not.toHaveClass("h-7");
  });

  it("floors Undo/Redo on narrow ONLY — the same pair draws the Desktop header", () => {
    render(
      <UndoRedoButtons
        canUndo
        canRedo
        onUndo={() => {}}
        onRedo={() => {}}
        undoLabel="Undo"
        redoLabel="Redo"
      />,
    );
    for (const name of ["Undo", "Redo"]) {
      const btn = screen.getByRole("button", { name });
      expect(btn).toHaveClass("max-md:min-h-11", "max-md:min-w-11");
      // Unprefixed floors would grow the Desktop header row too.
      expect(btn).not.toHaveClass("min-h-11");
      // The painted mouse-size box is unchanged.
      expect(btn).toHaveClass("size-8");
    }
  });

  it("floors the confirm dialog's buttons on narrow, not on Desktop", () => {
    render(
      <ConfirmDialog
        open
        message="Delete this note?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    for (const name of ["Delete", "Cancel"]) {
      const btn = screen.getByRole("button", { name });
      expect(btn).toHaveClass("max-md:min-h-11");
      // The floor rides ON TOP of size="sm" rather than replacing it, so the
      // padding and type step stay exactly what Desktop has today.
      expect(btn).toHaveClass("h-7");
      expect(btn).not.toHaveClass("min-h-11");
    }
  });

  it("leaves the narrow tab band's pill alone — its target is already 44px", () => {
    /*
     * The audit read this at 33px, but that is the PAINTED pill: size="sm"
     * carries TAP_TARGET_TALL, an invisible 44px ::after that
     * getBoundingClientRect() cannot see. Growing the pill would put back the
     * height #1039 was asked to remove, so this asserts the band did NOT
     * change — if a later pass does grow it, that has to be a decision, not a
     * drive-by.
     */
    render(
      <SegmentedControl
        options={[
          { id: "morning", label: "朝刊" },
          { id: "evening", label: "夕刊" },
        ]}
        value="morning"
        onChange={() => {}}
        size="sm"
        label="Edition"
      />,
    );
    const tab = screen.getByRole("tab", { name: "朝刊" });
    expect(tab).toHaveClass("relative", "after:h-11", "after:inset-x-0");
    expect(tab).not.toHaveClass("min-h-11");
  });

  /*
   * #1832: the "md" track is the other half of that story. It is the in-panel
   * size — the Schedule detail tabs measured 98x33 — and it grows its BOX on a
   * phone rather than hanging a ::after over it. `inset-x-0` would be unsafe
   * here: under `singleLineLabels` the track wraps into two rows whose
   * neighbours sit 2px apart, so the 44px hit area would reach over the row
   * above.
   */
  it.each([false, true])(
    "floors an md segment on narrow (singleLineLabels=%s)",
    (singleLineLabels) => {
      render(
        <SegmentedControl
          options={[
            { id: "flow", label: "今日の流れ" },
            { id: "repeats", label: "繰り返し" },
          ]}
          value="flow"
          onChange={() => {}}
          singleLineLabels={singleLineLabels}
          label="Detail tabs"
        />,
      );
      const tab = screen.getByRole("tab", { name: "今日の流れ" });
      expect(tab).toHaveClass("max-md:min-h-11");
      // Desktop keeps the height it is drawn at.
      expect(tab).not.toHaveClass("min-h-11");
      expect(tab).not.toHaveClass("after:h-11");
    },
  );
});
