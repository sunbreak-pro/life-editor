import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickAddSheet } from "../src/components";

/*
 * Shortest-path add sheet. Nothing renders while closed. Submit is blocked
 * for empty / whitespace-only input; Enter submits (unless IME composition is
 * in progress) and clicks fire onSubmit with the trimmed value.
 */
function renderSheet(props?: Partial<Parameters<typeof QuickAddSheet>[0]>) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(
    <QuickAddSheet
      open
      onClose={onClose}
      title="Quick add"
      placeholder="What's on your mind?"
      submitLabel="Add"
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onSubmit, onClose };
}

describe("QuickAddSheet", () => {
  it("renders nothing while closed", () => {
    renderSheet({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables submit for empty input", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("keeps submit disabled for whitespace-only input", () => {
    renderSheet();
    fireEvent.change(screen.getByPlaceholderText("What's on your mind?"), {
      target: { value: "   " },
    });
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("enables and submits a trimmed value on button click", () => {
    const { onSubmit, onClose } = renderSheet();
    const input = screen.getByPlaceholderText("What's on your mind?");
    fireEvent.change(input, { target: { value: "  buy milk  " } });
    const btn = screen.getByRole("button", { name: "Add" });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(onSubmit).toHaveBeenCalledWith("buy milk");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("submits on Enter", () => {
    const { onSubmit } = renderSheet();
    const input = screen.getByPlaceholderText("What's on your mind?");
    fireEvent.change(input, { target: { value: "note" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("note");
  });

  it("does not submit on Enter while composing (IME guard)", () => {
    const { onSubmit } = renderSheet();
    const input = screen.getByPlaceholderText("What's on your mind?");
    fireEvent.change(input, { target: { value: "にほんご" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
