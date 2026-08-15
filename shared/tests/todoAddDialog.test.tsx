import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TodoAddDialog, type TodoAddDialogLabels } from "../src/components";

/*
 * Kanban "add a todo" overlay (#586 pins). The behavior under guard is the
 * open-transition reset: each time the dialog opens it starts from a CLEAN
 * form (a draft abandoned by closing never leaks into the next open) and
 * focuses the title input. Submit passes the trimmed title and is blocked
 * for empty / whitespace-only drafts; Enter is IME-guarded.
 */

const LABELS: TodoAddDialogLabels = {
  title: "Add todo",
  titleLabel: "Title",
  titlePlaceholder: "What needs doing?",
  submit: "Add",
  cancel: "Cancel",
};

function dialogProps(overrides?: Partial<Parameters<typeof TodoAddDialog>[0]>) {
  return {
    open: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    labels: LABELS,
    ...overrides,
  };
}

function titleInput(): HTMLInputElement {
  return screen.getByPlaceholderText("What needs doing?");
}

describe("TodoAddDialog", () => {
  it("renders nothing while closed", () => {
    render(<TodoAddDialog {...dialogProps({ open: false })} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables submit for empty and whitespace-only titles", () => {
    render(<TodoAddDialog {...dialogProps()} />);
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    fireEvent.change(titleInput(), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("submits the trimmed title as a parentless todo", () => {
    const props = dialogProps();
    render(<TodoAddDialog {...props} />);
    fireEvent.change(titleInput(), { target: { value: "  write specs  " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onSubmit).toHaveBeenCalledWith({
      type: "task",
      title: "write specs",
      parentId: null,
    });
  });

  it("does not submit on Enter while composing (IME guard)", () => {
    const props = dialogProps();
    render(<TodoAddDialog {...props} />);
    fireEvent.change(titleInput(), { target: { value: "にほんご" } });
    fireEvent.keyDown(titleInput(), { key: "Enter", isComposing: true });
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("resets the draft each time the dialog opens", () => {
    const props = dialogProps();
    const { rerender } = render(<TodoAddDialog {...props} />);
    fireEvent.change(titleInput(), { target: { value: "abandoned draft" } });
    rerender(<TodoAddDialog {...props} open={false} />);
    rerender(<TodoAddDialog {...props} open />);
    expect(titleInput().value).toBe("");
  });

  it("focuses the title input when the dialog opens", async () => {
    const props = dialogProps({ open: false });
    const { rerender } = render(<TodoAddDialog {...props} />);
    rerender(<TodoAddDialog {...props} open />);
    await waitFor(() => expect(titleInput()).toHaveFocus());
  });
});
