import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useElementWidth } from "../src/notes/hooks/useElementWidth";

/*
 * #1471 — the measuring end of "the template editor opens at the width of the
 * note it is edited over". jsdom has no layout (CLAUDE.md §7.1), so the box's
 * width is stubbed here: what is under test is the LIFECYCLE — measure when
 * the node arrives, follow a resize, stop observing when it leaves — not the
 * browser's arithmetic.
 *
 * The resize path is worth pinning rather than assuming: the note column is
 * whatever the drag-resizable right panel and the collapsible nav leave behind,
 * so "it was right when the dialog opened" is not the same as "it is right".
 */

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;
  // A plain field, not a constructor parameter property: web's tsconfig runs
  // `erasableSyntaxOnly`, which bans the shorthand (TS1294).
  readonly callback: () => void;

  constructor(callback: () => void) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }
  observe(target: Element) {
    this.observed.push(target);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  /** Stand in for the browser noticing the box changed size. */
  fire() {
    this.callback();
  }
}

let boxWidth = 0;

beforeEach(() => {
  FakeResizeObserver.instances = [];
  boxWidth = 642;
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    () =>
      ({
        width: boxWidth,
        height: 0,
        top: 0,
        left: 0,
        right: boxWidth,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Probe({ withBox = true }: { withBox?: boolean }) {
  const [measureRef, width] = useElementWidth();
  return (
    <>
      <span data-testid="width">{width == null ? "none" : String(width)}</span>
      {withBox && <div ref={measureRef} data-testid="box" />}
    </>
  );
}

const reported = () => screen.getByTestId("width").textContent;
const observer = () => FakeResizeObserver.instances[0];

describe("useElementWidth (#1471)", () => {
  it("reports the element's width as soon as it is attached", () => {
    render(<Probe />);

    expect(reported()).toBe("642");
  });

  it("rounds sub-pixel widths", () => {
    boxWidth = 641.6;
    render(<Probe />);

    // A drag handle produces fractions all day; nothing downstream can tell
    // 641.6 from 642, and re-rendering the tree for each one is pure cost.
    expect(reported()).toBe("642");
  });

  it("follows the box when it is resized", () => {
    render(<Probe />);
    expect(observer().observed).toHaveLength(1);

    boxWidth = 500;
    act(() => observer().fire());

    expect(reported()).toBe("500");
  });

  it("treats a box with no width as not measured rather than as zero", () => {
    boxWidth = 0;
    render(<Probe />);

    // The state every jsdom run is in, and the one a caller must be able to
    // fall back to CSS from — a zero would collapse the panel it sizes.
    expect(reported()).toBe("none");
  });

  it("stops observing when the element goes away", () => {
    const { rerender } = render(<Probe />);
    expect(observer().disconnected).toBe(false);

    rerender(<Probe withBox={false} />);

    expect(observer().disconnected).toBe(true);
  });
});
