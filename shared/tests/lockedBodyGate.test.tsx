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
});
