import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  within,
} from "@testing-library/react";
import { MobileDrawer, Modal, RightSidebarToggle } from "../src/components";
import { RightSidebarProvider } from "../src/context";
import {
  MOBILE_FONT_SIZE_STEPS,
  fontSizeToPx,
} from "../src/constants/fontSize";

/*
 * App Shell Turn 2 — Mobile left drawer. Same detail content as the Desktop
 * panel, portalled to <body>; opens via the hamburger toggle and closes on
 * Escape / scrim click. Modal semantics (role=dialog + aria-modal), with the
 * keyboard/focus behaviour shared through useDialogA11y (#517) — the trap
 * itself is covered in dialogFocus.test.tsx, these cases pin the WIRING.
 */

/** Runs the pending rAF callback — that is when initial focus is applied. */
async function afterFrame() {
  await act(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  });
}

const LABELS = {
  title: "Details",
  close: "Close details",
  empty: "Nothing selected yet",
};

function renderDrawer() {
  return render(
    <RightSidebarProvider>
      <RightSidebarToggle
        variant="hamburger"
        openLabel="Open details"
        closeLabel="Hide details"
      />
      <MobileDrawer
        title={LABELS.title}
        closeLabel={LABELS.close}
        emptyLabel={LABELS.empty}
      />
    </RightSidebarProvider>,
  );
}

describe("MobileDrawer", () => {
  it("is closed initially and opens the modal dialog on toggle", () => {
    renderDrawer();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    const dialog = screen.getByRole("dialog", { name: "Details" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  /*
   * #1284 removed the in-panel X from the DESKTOP panel only, and the body
   * both share (RightSidebarContents) is what draws it — so the one thing
   * keeping the mobile escape hatch alive is MobileDrawer continuing to pass
   * closeLabel + onClose. Nothing asserted that before, which means the next
   * "simplify RightSidebarContents" takes the drawer's only visible way out
   * with it. The drawer is modal and covers the hamburger that opened it.
   */
  it("keeps its own close button — the drawer covers the toggle (#1284)", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: LABELS.close }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when the scrim (backdrop) is clicked", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    const dialog = screen.getByRole("dialog", { name: "Details" });
    const scrim = dialog.parentElement as HTMLElement;
    fireEvent.mouseDown(scrim);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not close when the drawer body itself is clicked", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    const dialog = screen.getByRole("dialog", { name: "Details" });
    fireEvent.mouseDown(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("moves focus into the drawer on open and returns it on close", async () => {
    renderDrawer();
    const toggle = screen.getByRole("button", { name: "Open details" });

    toggle.focus();
    fireEvent.click(toggle);
    await afterFrame();
    const dialog = screen.getByRole("dialog", { name: "Details" });
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(toggle);
  });

  it("hands Escape to a dialog stacked on top, one layer per press", () => {
    const onCloseModal = vi.fn();
    function Stack({ modalOpen }: { modalOpen: boolean }) {
      return (
        <RightSidebarProvider>
          <RightSidebarToggle
            variant="hamburger"
            openLabel="Open details"
            closeLabel="Hide details"
          />
          <MobileDrawer
            title={LABELS.title}
            closeLabel={LABELS.close}
            emptyLabel={LABELS.empty}
          />
          <Modal open={modalOpen} onClose={onCloseModal} title="On top">
            <button type="button">modal button</button>
          </Modal>
        </RightSidebarProvider>
      );
    }
    const { rerender } = render(<Stack modalOpen={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    rerender(<Stack modalOpen />);

    // The modal opened after the drawer, so it owns the Escape…
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCloseModal).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "Details" })).toBeInTheDocument();

    // …and once it is gone the drawer takes the next one.
    rerender(<Stack modalOpen={false} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Details" }),
    ).not.toBeInTheDocument();
  });
});

/*
 * #1400 — the panel's width was `w-80` (20rem), and the appearance setting
 * writes the root font size onto documentElement (ThemeContext), so the drawer
 * tracked the type scale: 280px on the small preset, 440px on the large one.
 *
 * jsdom resolves neither rem nor Tailwind — no layout, no stylesheet (CLAUDE.md
 * §7.1) — so the regression itself cannot be measured here. What IS visible is
 * the shape of the fix: an explicit px the component computes from the medium
 * preset, and the rem-based class gone. Same reasoning as the class assertions
 * in bottomSheetSafeArea.
 */
describe("MobileDrawer width", () => {
  afterEach(() => {
    document.documentElement.style.fontSize = "";
  });

  function openDrawer() {
    const view = renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    return { dialog: screen.getByRole("dialog", { name: LABELS.title }), view };
  }

  it("pins the panel to the width the medium preset gave it", () => {
    // 20rem at the medium preset's 18px. Spelled out rather than recomputed
    // from the constant, so moving the preset has to be a deliberate edit here.
    expect(openDrawer().dialog.style.width).toBe("360px");
  });

  it("keeps that one width across all three mobile font presets", () => {
    const widths = new Set<string>();

    for (const step of MOBILE_FONT_SIZE_STEPS) {
      document.documentElement.style.fontSize = `${fontSizeToPx(step)}px`;
      const { dialog, view } = openDrawer();
      widths.add(dialog.style.width);
      view.unmount();
    }

    expect([...widths]).toEqual(["360px"]);
  });

  it("caps at the viewport so a narrow phone keeps a strip of scrim to tap", () => {
    const { dialog } = openDrawer();

    expect(dialog).toHaveClass("max-w-[85vw]");
    expect(dialog.className).not.toContain("w-80");
  });
});
