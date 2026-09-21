import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Button } from "../src/components";

/*
 * #1804 — "disabled" and "working" looked the same.
 *
 * Six screens had already hand-written a spinner next to a label; the seventh
 * (NotePasswordDialog) raised `aria-busy` and stopped there, so the state
 * reached a screen reader and nobody else. The fix is a `busy` prop that
 * carries all three cues at once, and these fence each one — jsdom has no
 * layout, so what is observable here is the markup the cue is made of.
 */

afterEach(cleanup);

describe("Button busy state (#1804)", () => {
  it("shows a spinner, not just aria-busy", () => {
    const { container } = render(<Button busy>Save</Button>);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-busy", "true");
    // The visible half. `animate-spin` is the cue a sighted user gets, and it
    // is exactly what the aria-busy-only call site was missing.
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("says 'working' in words for anyone who reduced motion", () => {
    // A spinner that is not allowed to spin says nothing at all, so the label
    // has to carry the state on its own in that mode.
    const { container } = render(
      <Button busy busyLabel="Saving…">
        Save
      </Button>,
    );

    expect(screen.getByRole("button")).toHaveTextContent("Saving…");
    expect(screen.queryByText("Save")).toBeNull();
    // Read the class attribute rather than selecting on it: the spinner is an
    // <svg>, whose `className` is an SVGAnimatedString, and the Tailwind
    // variant's colon would need escaping inside a selector.
    const spinner = container.querySelector(".animate-spin");
    expect(spinner?.getAttribute("class")).toContain(
      "motion-reduce:animate-none",
    );
  });

  it("keeps the normal label when the caller has no busy wording", () => {
    render(<Button busy>Save</Button>);

    expect(screen.getByRole("button")).toHaveTextContent("Save");
  });

  it("blocks a second press while the first is still running", () => {
    // ui-states.md §Submitting: busy without disabled is a double submit
    // waiting to happen, and every call site was passing both by hand.
    render(<Button busy>Save</Button>);

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("swaps the leading icon out rather than spinning beside it", () => {
    render(
      <Button busy leadingIcon={<span data-testid="icon" />}>
        Save
      </Button>,
    );

    expect(screen.queryByTestId("icon")).toBeNull();
  });

  it("stays quiet — no spinner, no aria-busy — when it is merely disabled", () => {
    // The whole point: a dead button and a working one must not produce the
    // same markup, because they do not mean the same thing.
    const { container } = render(<Button disabled>Save</Button>);

    expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy");
    expect(container.querySelector(".animate-spin")).toBeNull();
  });
});
