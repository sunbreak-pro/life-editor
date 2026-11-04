import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LoadErrorCard } from "../src/components";

/*
 * The shared "could not load" card (#2620): danger surface, normal-text body,
 * and a retry button that cannot be pressed twice while the reload runs.
 */
describe("LoadErrorCard", () => {
  it("renders an alert with the message and a retry button", () => {
    render(
      <LoadErrorCard
        message="予定を読み込めませんでした"
        retryLabel="再試行"
        onRetry={() => {}}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("予定を読み込めませんでした");
    expect(alert.className).toContain("border-lumen-danger");
    expect(alert.className).toContain("bg-lumen-danger-subtle");
    // The body stays in normal text; only the glyph carries the danger color.
    const body = screen.getByText("予定を読み込めませんでした");
    expect(body.className).toContain("text-lumen-text");
    expect(body.className).not.toContain("text-lumen-danger");
    expect(alert.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "再試行" })).toBeEnabled();
  });

  it("calls onRetry when the button is pressed", () => {
    const onRetry = vi.fn();
    render(
      <LoadErrorCard message="失敗" retryLabel="再試行" onRetry={onRetry} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("disables the button and marks it busy while retrying", () => {
    const onRetry = vi.fn();
    render(
      <LoadErrorCard
        message="失敗"
        retryLabel="再試行"
        retryingLabel="読み込み中…"
        retrying
        onRetry={onRetry}
      />,
    );
    const button = screen.getByRole("button", { name: "読み込み中…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("carries the 44px touch floor below the breakpoint", () => {
    render(
      <LoadErrorCard message="失敗" retryLabel="再試行" onRetry={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "再試行" }).className).toContain(
      "max-md:min-h-11",
    );
  });
});
