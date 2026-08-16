import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResponsiveDetailFrame } from "../src/components";

/*
 * ResponsiveDetailFrame (#889) — the width picks the frame, the caller keeps
 * the body and the close.
 *
 * Schedule's two returns each used to spell the frame out for the event editor
 * and the todo detail: an ItemDetailOverlay in the wide branch, a BottomSheet
 * in the narrow one, with the same title, the same body and the same close
 * guard copied between them. What these cases pin is the part that made the
 * copies dangerous rather than merely long — that both frames render the SAME
 * children and route their close to the SAME handler, whichever one the width
 * chose.
 */

function renderFrame(over?: { wide?: boolean; open?: boolean }) {
  const onClose = vi.fn();
  render(
    <ResponsiveDetailFrame
      wide={over?.wide ?? true}
      open={over?.open ?? true}
      title="Details"
      closeLabel="Close"
      onClose={onClose}
    >
      <p>the body</p>
    </ResponsiveDetailFrame>,
  );
  return { onClose };
}

describe("ResponsiveDetailFrame", () => {
  it("shows the same body on either width", () => {
    renderFrame({ wide: true });
    screen.getByText("the body");
    screen.getByText("Details");
  });

  it("shows the same body in the narrow frame", () => {
    renderFrame({ wide: false });
    screen.getByText("the body");
    screen.getByText("Details");
  });

  it("routes the wide frame's Escape to the caller's handler", () => {
    // The one guard the host wires (discard-changes) has to be reachable from
    // both layouts — losing it on one of them was the hazard the two literals
    // carried. The overlay has no close button of its own; Escape is its exit.
    const wide = renderFrame({ wide: true });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(wide.onClose).toHaveBeenCalledTimes(1);
  });

  it("routes the narrow frame's close to the caller's handler too", () => {
    const narrow = renderFrame({ wide: false });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(narrow.onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing while closed, on either width", () => {
    renderFrame({ wide: true, open: false });
    expect(screen.queryByText("the body")).toBeNull();
  });

  it("renders nothing while the narrow frame is closed", () => {
    renderFrame({ wide: false, open: false });
    expect(screen.queryByText("the body")).toBeNull();
  });
});
