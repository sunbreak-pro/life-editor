import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LockedBodyGate } from "../src/components";

/*
 * #526 — the body-only note lock, shared by the Desktop detail and the mobile
 * sheet. The behaviour that matters is what the gate does NOT touch: it wraps
 * the body alone, so the panel around it (title / tags / pin / delete) is out
 * of its reach by construction. Before this, the mobile sheet replaced the
 * whole panel, and a locked note could not even be renamed from a phone.
 *
 * jsdom has no layout, so the blur itself is not observable here — the class
 * and aria-hidden are, and those are what carry it.
 */

describe("LockedBodyGate", () => {
  it("hides the body behind an unlock CTA while locked", () => {
    const onUnlock = vi.fn();
    render(
      <LockedBodyGate locked hint="Locked — tap to unlock" onUnlock={onUnlock}>
        <p>secret body</p>
      </LockedBodyGate>,
    );

    // The body is still mounted (the CTA sits OVER it, so unlocking does not
    // re-mount the editor and lose a draft) but taken out of the a11y tree.
    const body = screen.getByText("secret body").parentElement;
    expect(body).toHaveClass("blur-md");
    expect(body).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(
      screen.getByRole("button", { name: /Locked — tap to unlock/ }),
    );
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it("leaves the body alone once unlocked", () => {
    render(
      <LockedBodyGate
        locked={false}
        hint="Locked — tap to unlock"
        onUnlock={vi.fn()}
      >
        <p>secret body</p>
      </LockedBodyGate>,
    );

    const body = screen.getByText("secret body").parentElement;
    expect(body).not.toHaveClass("blur-md");
    expect(body).not.toHaveAttribute("aria-hidden");
    expect(screen.queryByRole("button")).toBeNull();
  });

  /*
   * #2585 — the cover draws blurred stand-in lines of its own and, when the
   * host hands over a label, an explicit unlock button. The stand-in must not
   * be built from the children: since #1763 a locked note's body is never
   * fetched, and the cover must not reintroduce a copy of it either.
   */
  it("shows stand-in lines and an explicit unlock button", () => {
    const onUnlock = vi.fn();
    render(
      <LockedBodyGate
        locked
        hint="このノートはロックされています"
        unlockLabel="ロックを解除"
        onUnlock={onUnlock}
      >
        <p>secret body</p>
      </LockedBodyGate>,
    );

    const placeholder = screen.getByTestId("locked-body-placeholder");
    expect(placeholder).toHaveAttribute("aria-hidden", "true");
    expect(placeholder).toHaveClass("blur-[6px]");
    expect(placeholder.children.length).toBeGreaterThan(0);
    expect(placeholder.textContent).toBe("");
    expect(placeholder).not.toHaveTextContent("secret body");

    expect(screen.getByText("このノートはロックされています")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "ロックを解除" });
    // Exactly one control: the cover is not a second button around it.
    expect(screen.getAllByRole("button")).toEqual([button]);

    fireEvent.click(button);
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it("still starts the unlock from a press anywhere on the cover", () => {
    const onUnlock = vi.fn();
    render(
      <LockedBodyGate
        locked
        hint="Locked"
        unlockLabel="Unlock"
        onUnlock={onUnlock}
      >
        <p>secret body</p>
      </LockedBodyGate>,
    );

    fireEvent.click(screen.getByText("Locked"));
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it("draws no cover or stand-in once unlocked", () => {
    render(
      <LockedBodyGate
        locked={false}
        hint="Locked"
        unlockLabel="Unlock"
        onUnlock={vi.fn()}
      >
        <p>secret body</p>
      </LockedBodyGate>,
    );
    expect(screen.queryByTestId("locked-body-placeholder")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps the whole cover as the one button while no label is handed over", () => {
    const onUnlock = vi.fn();
    render(
      <LockedBodyGate locked hint="Locked" onUnlock={onUnlock}>
        <p>secret body</p>
      </LockedBodyGate>,
    );

    // The hosts do not pass unlockLabel yet; the stand-in is drawn anyway, but
    // hidden, so it does not leak into the button's name.
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName("Locked");
    const placeholder = screen.getByTestId("locked-body-placeholder");
    expect(placeholder).toHaveAttribute("aria-hidden", "true");
    expect(buttons[0]).toContainElement(placeholder);

    fireEvent.click(buttons[0]);
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });
});
