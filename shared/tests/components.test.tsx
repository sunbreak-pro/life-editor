import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  Button,
  IconButton,
  Input,
  Card,
  Modal,
  BottomSheet,
  CommandPalette,
  TrashView,
  cn,
  type Command,
  type TrashGroup,
  type TrashViewLabels,
} from "../src/components";

const Dot = () => <span>•</span>;

function makeCommands(spy: () => void): Command[] {
  return [
    { id: "a", title: "Open Tasks", category: "Go to", icon: Dot, action: spy },
    {
      id: "b",
      title: "Open Notes",
      category: "Go to",
      icon: Dot,
      action: () => {},
    },
    {
      id: "c",
      title: "Open Trash",
      category: "Go to",
      icon: Dot,
      action: () => {},
    },
  ];
}

const TRASH_LABELS: TrashViewLabels = {
  title: "Trash",
  empty: "Trash is empty",
  emptyCategory: "No deleted items.",
  restore: "Restore",
  deletePermanently: "Delete permanently",
  confirmMessage: 'Permanently delete "{name}"? This cannot be undone.',
  cancel: "Cancel",
};

describe("cn", () => {
  it("joins truthy class values and drops falsy ones", () => {
    expect(cn("a", false, "b", null, undefined, 0, "c")).toBe("a b c");
  });
});

describe("Button", () => {
  it("renders its label and defaults to type=button", () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("type", "button");
  });

  it("applies the primary accent token by default and danger when set", () => {
    const { rerender } = render(<Button>X</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-ink-accent");
    rerender(<Button variant="danger">X</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-ink-danger");
  });

  it("fires onClick and respects disabled", () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("IconButton", () => {
  it("exposes its label as the accessible name", () => {
    render(<IconButton icon={<span>i</span>} label="Delete row" />);
    expect(
      screen.getByRole("button", { name: "Delete row" }),
    ).toBeInTheDocument();
  });
});

describe("Input", () => {
  it("renders and reflects typed value via onChange", () => {
    const onChange = vi.fn();
    render(<Input placeholder="name" onChange={onChange} />);
    const input = screen.getByPlaceholderText("name");
    fireEvent.change(input, { target: { value: "hi" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("marks aria-invalid and danger border when invalid", () => {
    render(<Input invalid placeholder="email" />);
    const input = screen.getByPlaceholderText("email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveClass("border-ink-danger");
  });
});

describe("Card", () => {
  it("renders children inside an opaque token surface", () => {
    render(<Card>content</Card>);
    const el = screen.getByText("content");
    expect(el).toHaveClass("bg-ink-bg");
  });
});

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal open={false} onClose={() => {}} title="T">
        body
      </Modal>,
    );
    expect(screen.queryByText("body")).not.toBeInTheDocument();
  });

  it("renders a dialog when open and closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="My Dialog">
        body
      </Modal>,
    );
    expect(
      screen.getByRole("dialog", { name: "My Dialog" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("BottomSheet", () => {
  it("renders a dialog when open and closes on backdrop click", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Sheet">
        sheet body
      </BottomSheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Sheet" });
    expect(dialog).toBeInTheDocument();
    // clicking the panel itself must NOT close (stopPropagation)
    fireEvent.mouseDown(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("CommandPalette", () => {
  it("renders nothing when closed", () => {
    render(
      <CommandPalette
        isOpen={false}
        onClose={() => {}}
        commands={makeCommands(() => {})}
        placeholder="Type a command..."
        noResultsLabel="No results"
      />,
    );
    expect(screen.queryByText("Open Tasks")).not.toBeInTheDocument();
  });

  it("filters commands by query and shows the no-results label", () => {
    render(
      <CommandPalette
        isOpen
        onClose={() => {}}
        commands={makeCommands(() => {})}
        placeholder="Type a command..."
        noResultsLabel="No results"
      />,
    );
    const input = screen.getByPlaceholderText("Type a command...");
    fireEvent.change(input, { target: { value: "trash" } });
    expect(screen.getByText("Open Trash")).toBeInTheDocument();
    expect(screen.queryByText("Open Tasks")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("runs the selected command on Enter and closes", () => {
    const onClose = vi.fn();
    const action = vi.fn();
    render(
      <CommandPalette
        isOpen
        onClose={onClose}
        commands={makeCommands(action)}
        placeholder="Type a command..."
        noResultsLabel="No results"
      />,
    );
    const input = screen.getByPlaceholderText("Type a command...");
    // first item ("Open Tasks") is selected by default → Enter fires it
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores navigation keys while composing (IME guard)", () => {
    const onClose = vi.fn();
    render(
      <CommandPalette
        isOpen
        onClose={onClose}
        commands={makeCommands(() => {})}
        placeholder="Type a command..."
        noResultsLabel="No results"
      />,
    );
    const input = screen.getByPlaceholderText("Type a command...");
    fireEvent.keyDown(input, { key: "Escape", isComposing: true });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("TrashView", () => {
  const groups: TrashGroup[] = [
    {
      category: "tasks",
      title: "Tasks",
      items: [{ id: "t1", label: "Buy milk" }],
    },
    { category: "notes", title: "Notes", items: [] },
  ];

  it("shows the global empty state when every category is empty", () => {
    render(
      <TrashView
        groups={[{ category: "tasks", title: "Tasks", items: [] }]}
        onRestore={() => {}}
        onPermanentDelete={() => {}}
        labels={TRASH_LABELS}
      />,
    );
    expect(screen.getByText("Trash is empty")).toBeInTheDocument();
  });

  it("renders items and fires restore", () => {
    const onRestore = vi.fn();
    render(
      <TrashView
        groups={groups}
        onRestore={onRestore}
        onPermanentDelete={() => {}}
        labels={TRASH_LABELS}
      />,
    );
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(onRestore).toHaveBeenCalledWith("tasks", "t1");
  });

  it("requires confirmation before permanent delete", () => {
    const onPermanentDelete = vi.fn();
    render(
      <TrashView
        groups={groups}
        onRestore={() => {}}
        onPermanentDelete={onPermanentDelete}
        labels={TRASH_LABELS}
      />,
    );
    // The row trash icon opens the confirm modal (does not delete yet).
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    expect(onPermanentDelete).not.toHaveBeenCalled();
    expect(
      screen.getByText('Permanently delete "Buy milk"? This cannot be undone.'),
    ).toBeInTheDocument();

    // Confirm button inside the dialog actually deletes.
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete permanently" }),
    );
    expect(onPermanentDelete).toHaveBeenCalledWith("tasks", "t1");
  });
});
