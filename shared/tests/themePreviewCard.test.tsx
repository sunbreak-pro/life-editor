import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemePreviewCard } from "../src/components";

/*
 * Miniature theme-preview radio. Pure presentation: exposes role="radio" +
 * aria-checked for the active theme and reports the selected value on click.
 */
describe("ThemePreviewCard", () => {
  it("exposes aria-checked reflecting the selected state", () => {
    render(
      <>
        <ThemePreviewCard
          value="light"
          label="ライト"
          selected
          onSelect={() => {}}
        />
        <ThemePreviewCard
          value="dark"
          label="ダーク"
          selected={false}
          onSelect={() => {}}
        />
      </>,
    );
    expect(screen.getByRole("radio", { name: "ライト" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "ダーク" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  // #887: the miniatures had gone identical, so the label glyph is the cue
  // that survives independently of color (sun / moon / OS-follow sun-moon).
  it.each([
    ["light", "light"],
    ["dark", "dark"],
    ["system", "split"],
  ])("labels the %s card with the %s glyph", (value, glyph) => {
    const { container } = render(
      <ThemePreviewCard
        value={value}
        label={value}
        selected={false}
        onSelect={() => {}}
      />,
    );
    expect(
      container.querySelector(`[data-theme-glyph="${glyph}"]`),
    ).not.toBeNull();
  });

  it("gives the three cards three different glyphs", () => {
    const { container } = render(
      <>
        <ThemePreviewCard
          value="light"
          label="ライト"
          selected
          onSelect={() => {}}
        />
        <ThemePreviewCard
          value="dark"
          label="ダーク"
          selected={false}
          onSelect={() => {}}
        />
        <ThemePreviewCard
          value="system"
          label="システム"
          selected={false}
          onSelect={() => {}}
        />
      </>,
    );
    const glyphs = [...container.querySelectorAll("[data-theme-glyph]")].map(
      (node) => node.getAttribute("data-theme-glyph"),
    );
    expect(glyphs).toHaveLength(3);
    expect(new Set(glyphs).size).toBe(3);
  });

  it("paints each miniature in its own fixed theme", () => {
    // The mocks opt out of the app theme via data-theme; "system" shows both
    // halves. Losing these is how #887 made the cards indistinguishable.
    const { container: light } = render(
      <ThemePreviewCard
        value="light"
        label="ライト"
        selected={false}
        onSelect={() => {}}
      />,
    );
    expect(light.querySelector('[data-theme="light"]')).not.toBeNull();
    expect(light.querySelector('[data-theme="dark"]')).toBeNull();

    const { container: system } = render(
      <ThemePreviewCard
        value="system"
        label="システム"
        selected={false}
        onSelect={() => {}}
      />,
    );
    expect(system.querySelector('[data-theme="light"]')).not.toBeNull();
    expect(system.querySelector('[data-theme="dark"]')).not.toBeNull();
  });

  it("fires onSelect with its theme value on click", () => {
    const onSelect = vi.fn();
    render(
      <ThemePreviewCard
        value="dark"
        label="ダーク"
        selected={false}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "ダーク" }));
    expect(onSelect).toHaveBeenCalledWith("dark");
  });
});
