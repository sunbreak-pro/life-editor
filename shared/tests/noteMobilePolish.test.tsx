import { afterEach, describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { NoteDetailPanel, TagPill } from "../src/components";

/*
 * #2291 — the Mobile note screen, items 2, 6 and 7 of the 2026-10-19 sweep.
 *
 * jsdom has no layout, so what is pinned is what the browser is asked for:
 * the narrow title field is a textarea capped at two lines, the stuck header
 * reports itself (an IntersectionObserver stub stands in for the scroll), and
 * a tag chip's X takes the 44px square below the breakpoint.
 */

const LABELS = {
  titleLabel: "Note title",
  pinLabel: "Unpin note",
  unpinLabel: "Pin note",
  deleteLabel: "Delete note",
  moreActionsLabel: "More actions",
  pinnedLabel: "Pinned",
};

function renderPanel(
  props: Partial<ComponentProps<typeof NoteDetailPanel>> = {},
) {
  return render(
    <NoteDetailPanel
      noteId="note-a"
      title="A note whose title runs on"
      isPinned={false}
      onTitleCommit={() => {}}
      onTogglePin={() => {}}
      onDelete={() => {}}
      tagsSlot={<span>design</span>}
      contentEditor={<div>editor slot</div>}
      {...LABELS}
      {...props}
    />,
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Narrow note title (#2291 item 7)", () => {
  it("is a textarea that grows to two lines on the compact variant", () => {
    renderPanel();
    const field = screen.getByLabelText("Note title");
    expect(field.tagName).toBe("TEXTAREA");
    expect(field.getAttribute("rows")).toBe("1");
    expect(field.className).toContain("max-h-[calc(2lh+0.75rem+2px)]");
    expect(field.className).toContain("resize-none");
  });

  it("keeps the wide heading a one-line input", () => {
    renderPanel({ variant: "main" });
    expect(screen.getByLabelText("Note title").tagName).toBe("INPUT");
  });

  it("does not take a line break: Enter is held, a pasted break is a space", () => {
    vi.useFakeTimers();
    const onTitleCommit = vi.fn();
    renderPanel({ onTitleCommit });
    const field = screen.getByLabelText("Note title");

    expect(fireEvent.keyDown(field, { key: "Enter" })).toBe(false);
    // An Enter that commits an IME conversion is left to the IME.
    expect(fireEvent.keyDown(field, { key: "Enter", isComposing: true })).toBe(
      true,
    );

    fireEvent.change(field, { target: { value: "first\nsecond" } });
    expect((field as HTMLTextAreaElement).value).toBe("first second");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onTitleCommit).toHaveBeenCalledExactlyOnceWith(
      "note-a",
      "first second",
    );
  });
});

describe("Stuck note header edge (#2291 item 6)", () => {
  type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;

  function stubObserver(): { fire: Callback } {
    let callback: Callback = () => {};
    class Stub {
      constructor(cb: Callback) {
        callback = cb;
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", Stub);
    return { fire: (entries) => callback(entries) };
  }

  const rect = (top: number) => ({ top }) as DOMRectReadOnly;

  it("draws a shadow and the stronger rule once the card's top has scrolled past", () => {
    const io = stubObserver();
    renderPanel({ stickyHeader: true });
    const header = screen.getByTestId("note-detail-header");
    const rule = screen.getByTestId("note-detail-divider");
    expect(header.hasAttribute("data-stuck")).toBe(false);
    expect(rule.className).toContain("border-lumen-border");
    expect(rule.className).not.toContain("border-lumen-border-strong");

    act(() =>
      io.fire([
        {
          isIntersecting: false,
          boundingClientRect: rect(-40),
          rootBounds: rect(0),
        },
      ]),
    );
    expect(header.hasAttribute("data-stuck")).toBe(true);
    expect(header.className).toContain("shadow-lumen-sm");
    expect(rule.className).toContain("border-lumen-border-strong");

    act(() =>
      io.fire([
        {
          isIntersecting: true,
          boundingClientRect: rect(10),
          rootBounds: rect(0),
        },
      ]),
    );
    expect(header.hasAttribute("data-stuck")).toBe(false);
  });

  it("is not stuck when the card is out of view below, not above", () => {
    const io = stubObserver();
    renderPanel({ stickyHeader: true });
    act(() =>
      io.fire([
        {
          isIntersecting: false,
          boundingClientRect: rect(900),
          rootBounds: rect(0),
        },
      ]),
    );
    expect(
      screen.getByTestId("note-detail-header").hasAttribute("data-stuck"),
    ).toBe(false);
  });
});

describe("Tag chip remove X on narrow (#2291 item 2)", () => {
  it('takes the 44px square below the breakpoint only with touch="narrow"', () => {
    render(
      <TagPill
        name="Work"
        color={null}
        onRemove={() => {}}
        removeLabel="Remove Work"
        touch="narrow"
      />,
    );
    const x = screen.getByRole("button", { name: "Remove Work" });
    expect(x.className).toContain("max-md:min-h-11");
    expect(x.className).toContain("max-md:min-w-11");
    // Not the always-on square, so Desktop chips keep their size.
    expect(x.className.split(" ")).not.toContain("min-h-11");
  });
});
