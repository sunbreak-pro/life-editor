import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Button, type ButtonVariant } from "../src/components";

/*
 * #1474 — a disabled primary button still read as pressable.
 *
 * jsdom has no layout and loads no stylesheet, so "does this look clickable"
 * is not observable here and no assertion can prove it. What IS the defect,
 * exactly, is the lever the disabled state pulls: `disabled:opacity-*` on an
 * accent FILL keeps the hue and only fades it, and hue is the whole signal a
 * user reads as "primary action". Dark theme is where it bites — the accent is
 * a pale indigo, so half of it over the card sits next to the enabled fill.
 *
 * So these fence the lever: the disabled state must change the COLOUR, and it
 * must survive a hover. Reverted locally to confirm they go red without the
 * fix.
 */

function classesFor(variant: ButtonVariant): string {
  render(
    <Button variant={variant} disabled>
      Save
    </Button>,
  );
  const classes = screen.getByRole("button", { name: "Save" }).className;
  cleanup();
  return classes;
}

describe("Button disabled fill (#1474)", () => {
  it("drops the primary variant to a surface fill instead of fading the accent", () => {
    const classes = classesFor("primary");

    expect(classes).not.toMatch(/disabled:opacity-\d/);
    expect(classes).toContain("disabled:bg-lumen-surface-sunken");
    expect(classes).toContain("disabled:text-lumen-text-tertiary");
  });

  it("keeps the dead primary button's box visible against its card", () => {
    // The sunken surface is a RECESS: measured against the card it sits on it
    // is 1.07:1 in light and 1.21:1 in dark, i.e. all but invisible on its own.
    // Without the ring the button stops looking like a control at all, which
    // is a different bug rather than a fix for this one.
    const classes = classesFor("primary");

    expect(classes).toContain("disabled:ring-1");
    expect(classes).toContain("disabled:ring-lumen-border-strong");
  });

  it("does not let a hover repaint the dead primary button", () => {
    // `:hover` still matches a disabled button — that is exactly why
    // `disabled:cursor-not-allowed` works — and `.hover\:x:hover` ties with
    // `.disabled\:y:disabled` on specificity, so source order would decide it.
    const classes = classesFor("primary");

    expect(classes).toContain("disabled:hover:bg-lumen-surface-sunken");
    expect(classes).toContain("disabled:hover:opacity-100");
  });

  it("leaves the non-filled variants on the opacity treatment", () => {
    // Deliberate, not an oversight. secondary/ghost are already surface
    // coloured, so fading them reads as disabled without changing hue.
    // `danger` shares the primary's defect and its fix, but its disabled state
    // is a BUSY state on three screens, where a flat grey would say "switched
    // off" rather than "working" — that is a UX call, and it is queued.
    for (const variant of ["secondary", "ghost", "danger"] as const) {
      expect(classesFor(variant)).toContain("disabled:opacity-50");
    }
  });
});
