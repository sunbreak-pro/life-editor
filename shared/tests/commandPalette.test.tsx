import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Dot } from "lucide-react";
import { CommandPalette, type Command } from "../src/components";

/*
 * CommandPalette — the palette had no coverage at all until #473 made it
 * touch-reachable from the narrow bottom bar's "More" sheet. Two things had to
 * hold before that route was worth opening, and both are asserted here:
 *
 *   - the panel fits inside the VISIBLE viewport, so the soft keyboard cannot
 *     bury the results (the old `vh` layout does not shrink for a keyboard),
 *   - tapping outside closes it — the pre-#473 `mousedown` dismissal is one iOS
 *     Safari never synthesizes for a bare backdrop div, which on a phone (no
 *     Escape key) made the palette a one-way door.
 *
 * Plus the Desktop keyboard path, which #473 must leave alone.
 *
 * jsdom has no layout, so this asserts the CONTRACT the browser then applies
 * (the frame's inline box + the shrink-enabling classes), not painted pixels.
 */

const COMMANDS: Command[] = [
  {
    id: "go-notes",
    title: "Notes",
    category: "Go to",
    icon: Dot,
    action: vi.fn(),
  },
  {
    id: "go-daily",
    title: "Daily",
    category: "Go to",
    icon: Dot,
    action: vi.fn(),
  },
];

function renderPalette(props?: Partial<Parameters<typeof CommandPalette>[0]>) {
  const onClose = vi.fn();
  render(
    <CommandPalette
      isOpen
      onClose={onClose}
      commands={COMMANDS}
      placeholder="Type a command..."
      noResultsLabel="No results found"
      {...props}
    />,
  );
  return { onClose };
}

/** The panel is the input's nearest ancestor div; the frame wraps the panel. */
function boxes() {
  const input = screen.getByPlaceholderText("Type a command...");
  const panel = input.closest("div.relative") as HTMLElement;
  return { input, panel, frame: panel.parentElement as HTMLElement };
}

/**
 * jsdom ships no visualViewport, so install a controllable stand-in. Returns a
 * `resize` that mutates it and fires the event the hook listens for — the same
 * sequence a phone produces when the soft keyboard slides up.
 */
function stubVisualViewport(initial: {
  offsetTop: number;
  offsetLeft: number;
  width: number;
  height: number;
}) {
  const listeners = new Set<() => void>();
  const vv = {
    ...initial,
    addEventListener: (_type: string, fn: () => void) => void listeners.add(fn),
    removeEventListener: (_type: string, fn: () => void) =>
      void listeners.delete(fn),
  };
  Object.defineProperty(window, "visualViewport", {
    value: vv,
    configurable: true,
    writable: true,
  });
  return {
    resize(next: Partial<typeof initial>) {
      Object.assign(vv, next);
      act(() => listeners.forEach((fn) => fn()));
    },
  };
}

afterEach(() => {
  Object.defineProperty(window, "visualViewport", {
    value: undefined,
    configurable: true,
    writable: true,
  });
});

describe("CommandPalette — keyboard-safe sizing (#473)", () => {
  it("sizes the frame to the visible viewport instead of the layout viewport", () => {
    stubVisualViewport({
      offsetTop: 0,
      offsetLeft: 0,
      width: 390,
      height: 780,
    });
    renderPalette();
    const { frame } = boxes();
    expect(frame.style.height).toBe("780px");
    // 12% top inset — the same proportion the pt-[12vh] fallback class applies,
    // so an unzoomed desktop window lands on the identical pixel.
    expect(frame.style.paddingTop).toBe("93.6px");
  });

  it("shrinks with the visible area when the soft keyboard opens", () => {
    const vv = stubVisualViewport({
      offsetTop: 0,
      offsetLeft: 0,
      width: 390,
      height: 780,
    });
    renderPalette();
    vv.resize({ height: 340 });
    const { frame, panel } = boxes();
    expect(frame.style.height).toBe("340px");
    // The panel is capped by the frame, and its list is allowed to shrink below
    // its content — without min-h-0 the 480px list would stay put and slide
    // right back under the keyboard.
    expect(panel.className).toContain("max-h-full");
    const list = panel.querySelector(".overflow-y-auto") as HTMLElement;
    expect(list.className).toContain("min-h-0");
  });

  it("follows the visible area when it is offset inside the layout viewport", () => {
    const vv = stubVisualViewport({
      offsetTop: 0,
      offsetLeft: 0,
      width: 390,
      height: 780,
    });
    renderPalette();
    vv.resize({ offsetTop: 120, height: 400 });
    expect(boxes().frame.style.top).toBe("120px");
  });

  it("falls back to the vh layout where the platform reports no viewport", () => {
    renderPalette();
    const { frame } = boxes();
    expect(frame.style.height).toBe("");
    expect(frame.className).toContain("pt-[12vh]");
  });

  it("keeps the panel content-height, not stretched to the frame", () => {
    renderPalette();
    // The frame is a flex row, so its default `stretch` would pull the panel
    // to full height — and `max-h-full` cannot claw that back, since it
    // resolves against the very height it was stretched to. jsdom has no
    // layout to measure, so the alignment itself is what gets pinned.
    expect(boxes().frame.className).toContain("items-start");
  });
});

describe("CommandPalette — dismissal", () => {
  it("closes on a pointer press outside the panel", () => {
    const { onClose } = renderPalette();
    const notCancelled = fireEvent.pointerDown(boxes().frame);
    expect(onClose).toHaveBeenCalledTimes(1);
    // Cancelled, so the touch synthesizes no click — the overlay is gone by
    // then, and an un-suppressed click would re-hit-test onto the section
    // underneath and fire whatever sits at that spot.
    expect(notCancelled).toBe(false);
  });

  it("stays open on a pointer press inside the panel", () => {
    const { onClose } = renderPalette();
    fireEvent.pointerDown(boxes().panel);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("CommandPalette — Desktop keyboard path (unchanged by #473)", () => {
  it("runs the selected command on Enter and closes first", () => {
    const { onClose } = renderPalette();
    fireEvent.keyDown(boxes().input, { key: "Enter" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves the selection with the arrow keys", () => {
    renderPalette();
    const { input } = boxes();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const rows = screen.getAllByRole("button");
    expect(rows[1].className).toContain("bg-lumen-hover");
    expect(rows[0].className).toContain("bg-transparent");
  });

  it("closes on Escape", () => {
    const { onClose } = renderPalette();
    fireEvent.keyDown(boxes().input, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("filters by the typed query", () => {
    renderPalette();
    fireEvent.change(boxes().input, { target: { value: "dai" } });
    expect(screen.getByRole("button", { name: "Daily" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Notes" })).toBeNull();
  });
});
