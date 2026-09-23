import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TourOverlay, type TourLabels } from "../src/components/tour";

/*
 * Two narrow-width / keyboard holes in the tour bubble, both found in the
 * 2026-09-23 real-browser pass over Epic #1121.
 *
 * #1977 — closing a MODAL step with Escape dropped focus on <body> whenever
 * there was no opener to return to: a fresh run opens on its own, and a run
 * from the Settings launcher has already navigated away from the launcher's
 * button. The bubble now hands focus to its anchor (or <main>).
 *
 * #1976 — the three footer buttons were 28px tall on a phone, and the last
 * action step offered no way to finish but a button labelled "Skip".
 *
 * jsdom has no layout, so the tap floor is asserted as the class that carries
 * it (the pixels are chat-main's job in a real browser, CLAUDE.md §7.1).
 */

const LABELS: TourLabels = {
  dialogLabel: "Tutorial step",
  next: "Next",
  done: "Done",
  skip: "Skip",
  endTour: "End tour",
  progress: "progress",
  waitingForAction: "Try it",
};

const mounted: HTMLElement[] = [];

function mount<T extends HTMLElement>(el: T): T {
  document.body.appendChild(el);
  mounted.push(el);
  return el;
}

afterEach(() => {
  while (mounted.length > 0) mounted.pop()?.remove();
});

interface RenderOptions {
  anchor: HTMLElement;
  waitsForAction?: boolean;
  stepNumber?: number;
  onSkip?: () => void;
  onDismiss?: () => void;
}

function renderOverlay({
  anchor,
  waitsForAction = false,
  stepNumber = 1,
  onSkip = vi.fn(),
  onDismiss = vi.fn(),
}: RenderOptions) {
  return render(
    <TourOverlay
      anchorElement={anchor}
      copy="Welcome."
      stepNumber={stepNumber}
      totalSteps={10}
      waitsForAction={waitsForAction}
      onNext={vi.fn()}
      onSkip={onSkip}
      onEnd={vi.fn()}
      onDismiss={onDismiss}
      labels={LABELS}
    />,
  );
}

/** An anchor the way AddPill / HeaderTabs render one: a control inside. */
function mountButtonAnchor(): { anchor: HTMLElement; control: HTMLElement } {
  const anchor = document.createElement("span");
  anchor.setAttribute("data-tour-id", "briefing-intro");
  const control = document.createElement("button");
  control.textContent = "Morning";
  anchor.appendChild(control);
  mount(anchor);
  return { anchor, control };
}

/**
 * Escape, then what the host does with it: `onDismiss` pauses the tour and
 * TourHost stops rendering the overlay.
 */
function escapeAndClose(view: ReturnType<typeof render>) {
  fireEvent.keyDown(document, { key: "Escape" });
  view.unmount();
}

describe("closing a modal step with Escape (#1977)", () => {
  it("hands focus to the anchor's control when the step opened on its own", () => {
    const { anchor, control } = mountButtonAnchor();
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);

    const onDismiss = vi.fn();
    const view = renderOverlay({ anchor, onDismiss });
    escapeAndClose(view);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(control);
  });

  it("falls back when the opener has left the page — the launcher case", () => {
    // The launcher's "walk the whole tour" button opens the run, and the run
    // navigates to Briefing before the bubble shows, so the button is detached
    // by the time the step closes.
    const launcherButton = mount(document.createElement("button"));
    launcherButton.focus();
    const { anchor, control } = mountButtonAnchor();

    const view = renderOverlay({ anchor });
    launcherButton.remove();
    escapeAndClose(view);

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(control);
  });

  it("still returns to an opener that is on the page", () => {
    const opener = mount(document.createElement("button"));
    opener.focus();
    const { anchor } = mountButtonAnchor();

    const view = renderOverlay({ anchor });
    escapeAndClose(view);

    expect(document.activeElement).toBe(opener);
  });

  it("uses <main> when the anchor holds nothing focusable", () => {
    const main = mount(document.createElement("main"));
    const anchor = mount(document.createElement("div"));
    (document.activeElement as HTMLElement | null)?.blur();

    const view = renderOverlay({ anchor });
    escapeAndClose(view);

    expect(document.activeElement).toBe(main);
    expect(main.getAttribute("tabindex")).toBe("-1");
  });
});

describe("the bubble's buttons on a phone (#1976)", () => {
  it("floors End, Skip and Next at 44px on narrow widths", () => {
    const { anchor } = mountButtonAnchor();
    renderOverlay({ anchor });

    for (const name of ["End tour", "Skip", "Next"]) {
      expect(screen.getByRole("button", { name }).className).toContain(
        "max-md:min-h-11",
      );
    }
  });

  it("offers Done on the last action step, and it finishes the run", () => {
    const { anchor } = mountButtonAnchor();
    const onSkip = vi.fn();
    renderOverlay({ anchor, waitsForAction: true, stepNumber: 10, onSkip });

    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("keeps Skip on an action step that is not the last", () => {
    const { anchor } = mountButtonAnchor();
    renderOverlay({ anchor, waitsForAction: true, stepNumber: 3 });

    expect(screen.getByRole("button", { name: "Skip" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
  });
});
