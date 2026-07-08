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
