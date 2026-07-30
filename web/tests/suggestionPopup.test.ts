import { describe, it, expect, vi, afterEach } from "vitest";
import {
  placeSuggestionMenu,
  createSuggestionPopup,
} from "../src/notes/suggestionPopup";

/*
 * Placement of the editor's suggestion menus ("[[" and "/") — #471.
 *
 * This is why the geometry is a pure function: the case that matters is a phone
 * with the soft keyboard up, and jsdom has no layout to reproduce it with
 * (rules/frontend.md §テスト環境の制約). Feeding the arithmetic the numbers a
 * real device reports is the only honest way to check it.
 *
 * The visible areas below are iPhone-class: 390x844, collapsing to 508px tall
 * while the keyboard is open, and ~300px tall in landscape with the keyboard.
 */

const DESKTOP = { top: 0, bottom: 900, left: 0, right: 1440 };
const PHONE = { top: 0, bottom: 844, left: 0, right: 390 };
const PHONE_KEYBOARD = { top: 0, bottom: 508, left: 0, right: 390 };
const LANDSCAPE_KEYBOARD = { top: 0, bottom: 300, left: 0, right: 844 };

/** A full "[[" menu: 8 candidates + 2 action rows at touch height. */
const MENU = { width: 256, height: 280 };

describe("placeSuggestionMenu", () => {
  it("sits just under the caret when there is room", () => {
    const placement = placeSuggestionMenu({
      caret: { top: 200, bottom: 220, left: 300 },
      menu: MENU,
      visible: DESKTOP,
    });
    expect(placement.side).toBe("below");
    expect(placement.top).toBe(226); // caret.bottom + the 6px gap
    expect(placement.left).toBe(300); // caret.left, nothing to clamp against
  });

  it("flips above the caret when the keyboard leaves no room below", () => {
    // A caret three quarters down a tall bottom sheet: 380px below it with the
    // keyboard closed, 44px with it open.
    const caret = { top: 430, bottom: 450, left: 40 };

    expect(
      placeSuggestionMenu({ caret, menu: MENU, visible: PHONE }).side,
    ).toBe("below");

    const open = placeSuggestionMenu({
      caret,
      menu: MENU,
      visible: PHONE_KEYBOARD,
    });
    expect(open.side).toBe("above");
    // Bottom edge lands one gap above the caret: 144 + 280 = 424 = 430 - 6.
    expect(open.top).toBe(144);
    expect(open.top).toBeGreaterThanOrEqual(PHONE_KEYBOARD.top);
  });

  it("caps the menu to the room below rather than flipping for a small shortfall", () => {
    const placement = placeSuggestionMenu({
      caret: { top: 200, bottom: 220, left: 40 },
      menu: MENU,
      visible: PHONE_KEYBOARD,
    });
    // 274px below vs 186px above: the menu (280px) fits neither, so it stays
    // below — where there is more of it — and scrolls inside the cap.
    expect(placement.side).toBe("below");
    expect(placement.maxHeight).toBe(274);
    expect(placement.top + placement.maxHeight).toBeLessThanOrEqual(
      PHONE_KEYBOARD.bottom,
    );
  });

  it("caps against a short visible area (landscape + keyboard)", () => {
    const placement = placeSuggestionMenu({
      caret: { top: 70, bottom: 90, left: 40 },
      menu: MENU,
      visible: LANDSCAPE_KEYBOARD,
    });
    expect(placement.side).toBe("below");
    expect(placement.maxHeight).toBe(196); // 300 - 8 edge - (90 + 6 gap)
    expect(placement.top).toBe(96);
  });

  it("keeps a floor on the cap, and stays inside the visible area anyway", () => {
    // Caret pinned to the bottom of the visible area: 26px above it, nothing
    // below. A 26px-tall menu would be useless, so it gets the 96px floor —
    // which then has to be clamped back inside the screen.
    const placement = placeSuggestionMenu({
      caret: { top: 40, bottom: 500, left: 40 },
      menu: MENU,
      visible: PHONE_KEYBOARD,
    });
    expect(placement.maxHeight).toBe(96);
    expect(placement.top).toBe(8);
  });

  it("pulls the menu back so its right edge fits the screen", () => {
    const placement = placeSuggestionMenu({
      caret: { top: 100, bottom: 120, left: 300 },
      menu: MENU,
      visible: PHONE,
    });
    expect(placement.left).toBe(126); // 390 - 8 edge - 256 wide
    expect(placement.left + MENU.width).toBeLessThanOrEqual(PHONE.right);
  });

  it("never pushes the menu off the left edge, even when it is wider than the screen", () => {
    const placement = placeSuggestionMenu({
      caret: { top: 100, bottom: 120, left: 10 },
      menu: { width: 500, height: 200 },
      visible: PHONE,
    });
    expect(placement.left).toBe(8); // the left margin wins the tie
  });

  it("never loosens the menu's own design height", () => {
    // Desktop has room for a 666px menu; the cap is applied as an inline style
    // that beats the list's max-h-72, so an uncapped value would STRETCH a
    // surface this change is not supposed to touch.
    const placement = placeSuggestionMenu({
      caret: { top: 200, bottom: 220, left: 300 },
      menu: MENU,
      visible: DESKTOP,
    });
    expect(placement.maxHeight).toBe(288);
  });

  it("respects a visible area that is offset, not just shrunk", () => {
    // Pinch-scrolled: visualViewport.offsetTop pushes the visible band down, so
    // "the top of the screen" is no longer y=0.
    const placement = placeSuggestionMenu({
      caret: { top: 220, bottom: 240, left: 40 },
      menu: MENU,
      visible: { top: 200, bottom: 500, left: 0, right: 390 },
    });
    expect(placement.side).toBe("below");
    expect(placement.maxHeight).toBe(246); // 500 - 8 - (240 + 6)
    expect(placement.top).toBe(246);
  });
});

/*
 * The DOM half. jsdom reports every element as 0x0, so the menu is a
 * zero-height box here — which is fine for what these check: that the popup
 * writes the placement out, reports the cap to the caller, and re-places itself
 * when the visible area changes. That last one IS the keyboard: opening it does
 * not move the caret, it only shrinks the visible area, so without the listener
 * a menu opened first would simply stay behind it.
 */

interface FakeViewport {
  offsetTop: number;
  offsetLeft: number;
  width: number;
  height: number;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
  emit: (type: string) => void;
}

function fakeViewport(height: number): FakeViewport {
  const listeners = new Map<string, Set<() => void>>();
  return {
    offsetTop: 0,
    offsetLeft: 0,
    width: 390,
    height,
    addEventListener: (type, fn) => {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener: (type, fn) => listeners.get(type)?.delete(fn),
    emit: (type) => listeners.get(type)?.forEach((fn) => fn()),
  };
}

function installViewport(vp: FakeViewport) {
  Object.defineProperty(window, "visualViewport", {
    value: vp,
    configurable: true,
    writable: true,
  });
}

function rect(top: number, bottom: number, left: number): DOMRect {
  return { top, bottom, left, right: left, width: 0, height: 0 } as DOMRect;
}

/**
 * Collect the ResizeObserver callbacks the popup registers, and let a test fire
 * them. jsdom has no ResizeObserver at all, so this is also the guard's only
 * exercise (createSuggestionPopup must survive its absence — the tests above run
 * without this stub installed).
 */
function stubResizeObserver() {
  const callbacks: Array<() => void> = [];
  let disconnects = 0;
  class FakeResizeObserver {
    constructor(cb: () => void) {
      callbacks.push(cb);
    }
    observe() {}
    unobserve() {}
    disconnect() {
      disconnects += 1;
    }
  }
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  return {
    fire: () => callbacks.forEach((cb) => cb()),
    disconnects: () => disconnects,
  };
}

afterEach(() => {
  Object.defineProperty(window, "visualViewport", {
    value: undefined,
    configurable: true,
    writable: true,
  });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createSuggestionPopup", () => {
  it("stays invisible until it has a real place to be", () => {
    // An absolutely-positioned element with no top/left renders wherever the
    // body flow left it — the bottom of the page. The caret rect is not always
    // available on the opening call, so the container must not be shown yet.
    const popup = createSuggestionPopup(() => {});
    expect(popup.el.parentElement).toBe(document.body);
    expect(popup.el.style.position).toBe("absolute");
    expect(popup.el.style.visibility).toBe("hidden");
    expect(popup.el.dataset.suggestionMenu).toBe("true");

    popup.position(() => null); // no caret yet
    expect(popup.el.style.visibility).toBe("hidden");

    popup.position(() => rect(100, 120, 40));
    expect(popup.el.style.visibility).toBe("visible");
    popup.destroy();
  });

  it("pulls the menu back inside the screen (the old code wrote the caret's own x)", () => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(256);
    const popup = createSuggestionPopup(() => {});

    popup.position(() => rect(100, 120, 900));
    // jsdom's window is 1024 wide: 1024 - 8 edge - 256 menu = 760.
    expect(popup.el.style.left).toBe("760px");
    popup.destroy();
  });

  it("re-reads the caret instead of reusing the rect it opened with", () => {
    // The browser scrolls the focused field into view when the keyboard opens,
    // so the caret has usually MOVED by the time the visible area shrinks. A
    // cached rect would place the menu against a caret that is no longer there.
    const vp = fakeViewport(800);
    installViewport(vp);
    const popup = createSuggestionPopup(() => {});
    let caret = rect(600, 620, 40);

    popup.position(() => caret);
    expect(popup.el.style.top).toBe("626px");

    caret = rect(300, 320, 40); // sheet scrolled the caret up
    vp.height = 440;
    vp.emit("resize");
    expect(popup.el.style.top).toBe("326px"); // against the NEW caret, not 600
    popup.destroy();
  });

  it("follows the caret when a nested scroller moves it", () => {
    // The note body is its own scroller inside the sheet. Scrolling it moves the
    // caret and fires nothing on window or visualViewport — the event does not
    // bubble — so the listener has to be a capture-phase one.
    const popup = createSuggestionPopup(() => {});
    let caret = rect(400, 420, 40);
    popup.position(() => caret);
    expect(popup.el.style.top).toBe("426px");

    caret = rect(200, 220, 40);
    document.body.dispatchEvent(new Event("scroll"));
    expect(popup.el.style.top).toBe("226px");
    popup.destroy();
  });

  it("reports the cap once, not on every keystroke", () => {
    installViewport(fakeViewport(844));
    const onMaxHeight = vi.fn();
    const popup = createSuggestionPopup(onMaxHeight);

    popup.position(() => rect(100, 120, 40));
    popup.position(() => rect(100, 120, 40));
    // 710px of room below, but the cap may only ever TIGHTEN the menu's own
    // max-h-72 — this inline value overrides that class.
    expect(onMaxHeight).toHaveBeenCalledExactlyOnceWith(288);
    popup.destroy();
  });

  it("re-places the menu when the soft keyboard shrinks the visible area", () => {
    const vp = fakeViewport(844);
    installViewport(vp);
    const onMaxHeight = vi.fn();
    const popup = createSuggestionPopup(onMaxHeight);

    // Caret low on the screen: room below it while the keyboard is closed.
    popup.position(() => rect(600, 620, 40));
    expect(popup.el.style.top).toBe("626px");

    vp.height = 400;
    vp.emit("resize");
    // The caret is now BELOW the visible area, so the menu must have moved off
    // its old spot and back inside the screen. (Exact numbers are not asserted:
    // jsdom measures the menu as 0-height, so the clamp does the work here —
    // the arithmetic itself is covered by placeSuggestionMenu above.)
    expect(popup.el.style.top).not.toBe("626px");
    expect(Number.parseFloat(popup.el.style.top)).toBeLessThanOrEqual(400 - 8);
    popup.destroy();
  });

  it("re-places itself once the menu has actually rendered", () => {
    // The first pass measures an EMPTY container: ReactRenderer schedules the
    // menu's render, so on the opening frame there is nothing in the box yet.
    // Everything looks like it fits — which is precisely when the keyboard case
    // would silently break, so the size observer has to correct it.
    installViewport(fakeViewport(508));
    const resize = stubResizeObserver();
    let menuHeight = 0;
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      () => menuHeight,
    );

    const popup = createSuggestionPopup(() => {});
    popup.position(() => rect(430, 450, 40));
    expect(popup.el.style.top).toBe("456px"); // 0-height box → "fits below"

    menuHeight = 280; // React commits the menu into the container
    resize.fire();
    expect(popup.el.style.top).toBe("144px"); // 280px does NOT fit → flips above

    popup.destroy();
    expect(resize.disconnects()).toBe(1);
  });

  it("stops listening once destroyed", () => {
    const vp = fakeViewport(844);
    installViewport(vp);
    const popup = createSuggestionPopup(() => {});
    popup.position(() => rect(600, 620, 40));
    popup.destroy();

    expect(popup.el.parentElement).toBeNull();
    vp.height = 400;
    expect(() => vp.emit("resize")).not.toThrow();
    expect(popup.el.style.top).toBe("626px"); // unchanged by the late resize
  });
});
