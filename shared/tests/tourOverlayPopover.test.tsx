import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { TourOverlay, type TourLabels } from "../src/components/tour";

/*
 * The bubble stands down for a popover it would otherwise cover (#1192).
 *
 * Measured in a real browser on `materials-note-tag`: the bubble sits at the
 * anchor's bottom-left, the tag picker opens in the same place, and the picker
 * lost — `elementFromPoint` on every option returned the bubble, and a click
 * could not reach a single tag.
 *
 * What is asserted here is PRESENCE, never placement: jsdom has no layout, so
 * every rect is all-zero and `elementFromPoint` is null (CLAUDE.md §7.1). The
 * overlap that motivated this is not reproducible here, which is exactly why
 * the fix is a state test — "is the bubble rendered while the anchor holds an
 * open control" — rather than a geometry one. The pixels are chat-main's job,
 * in a real browser.
 *
 * `TourOverlay` is pure presentation, so it is rendered directly with props;
 * standing up a Provider would put the probe loop between the test and the
 * thing under test.
 */

const LABELS: TourLabels = {
  dialogLabel: "Tutorial step",
  next: "Next",
  done: "Done",
  skip: "Skip",
  progress: "progress",
  waitingForAction: "Try it",
};

/**
 * The shape `materials-note-tag` really has: the tour anchor is a wrapper span
 * and the control wearing `aria-expanded` is a child of it (TagPicker's "+ Tag"
 * button inside the span at NoteDetailSurface). A fix that only looked at the
 * anchor element itself would pass a hand-built button and fail the app.
 */
const mounted: HTMLElement[] = [];

function mount<T extends HTMLElement>(el: T): T {
  document.body.appendChild(el);
  mounted.push(el);
  return el;
}

function mountAnchor(): { anchor: HTMLElement; control: HTMLButtonElement } {
  const anchor = document.createElement("span");
  anchor.setAttribute("data-tour-id", "materials-note-tag");
  const control = document.createElement("button");
  control.setAttribute("aria-expanded", "false");
  anchor.appendChild(control);
  mount(anchor);
  return { anchor, control };
}

/** MutationObserver callbacks are microtasks, so the flip needs a flush. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

function renderOverlay(anchor: HTMLElement, waitsForAction: boolean) {
  return render(
    <TourOverlay
      anchorElement={anchor}
      copy="Give it a tag."
      stepNumber={9}
      totalSteps={10}
      waitsForAction={waitsForAction}
      onNext={vi.fn()}
      onSkip={vi.fn()}
      onDismiss={vi.fn()}
      labels={LABELS}
    />,
  );
}

const bubble = () => screen.queryByRole("dialog", { name: "Tutorial step" });

afterEach(() => {
  // Only the nodes this file put there. Wiping `document.body` outright races
  // Testing Library's own cleanup, which is registered first and so runs last.
  while (mounted.length > 0) mounted.pop()?.remove();
});

describe("an action step whose anchor opens a popover (#1192)", () => {
  it("shows its bubble while the control is closed", () => {
    const { anchor } = mountAnchor();
    renderOverlay(anchor, true);

    expect(bubble()).not.toBeNull();
  });

  it("hides the bubble once the control reports itself expanded", async () => {
    const { anchor, control } = mountAnchor();
    renderOverlay(anchor, true);
    expect(bubble()).not.toBeNull();

    control.setAttribute("aria-expanded", "true");
    await settle();

    expect(bubble()).toBeNull();
  });

  it("brings the bubble back when the popover closes", async () => {
    const { anchor, control } = mountAnchor();
    renderOverlay(anchor, true);

    control.setAttribute("aria-expanded", "true");
    await settle();
    expect(bubble()).toBeNull();

    // The step has not advanced — the user opened the picker and closed it
    // again without choosing. The tour has to still be there.
    control.setAttribute("aria-expanded", "false");
    await settle();

    expect(bubble()).not.toBeNull();
  });

  it("notices a popover that MOUNTS its control rather than flipping a flag", async () => {
    // TagPicker mounts and unmounts the popover itself, and a future control
    // may swap in the whole expanded node. An attributes-only observer would
    // never see that, which is why childList is watched too.
    const { anchor, control } = mountAnchor();
    renderOverlay(anchor, true);

    const late = document.createElement("div");
    late.setAttribute("aria-expanded", "true");
    control.appendChild(late);
    await settle();

    expect(bubble()).toBeNull();
  });

  it("reads the flag on the anchor itself, not only on a descendant", async () => {
    // An anchor put straight on the button is just as plausible as the wrapper
    // span; both spellings have to count.
    const anchor = document.createElement("button");
    anchor.setAttribute("data-tour-id", "some-menu");
    anchor.setAttribute("aria-expanded", "false");
    mount(anchor);
    renderOverlay(anchor, true);

    anchor.setAttribute("aria-expanded", "true");
    await settle();

    expect(bubble()).toBeNull();
  });

  it("ignores a control that merely CARRIES the attribute while closed", async () => {
    // React renders `aria-expanded="false"` as a present attribute, so a bare
    // `[aria-expanded]` selector would suppress the bubble permanently.
    const { anchor, control } = mountAnchor();
    renderOverlay(anchor, true);

    control.setAttribute("aria-expanded", "false");
    await settle();

    expect(bubble()).not.toBeNull();
  });
});

describe("a step that advances on its own button (#1192)", () => {
  it("keeps its bubble even while the anchor is expanded", async () => {
    // The bubble IS the only way to finish a modal step. Hiding it there would
    // strand the tour, which is worse than the overlap being fixed.
    const { anchor, control } = mountAnchor();
    renderOverlay(anchor, false);

    control.setAttribute("aria-expanded", "true");
    await settle();

    expect(bubble()).not.toBeNull();
    expect(screen.getByText("Next")).toBeTruthy();
  });
});
