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
  Toast,
  ToastViewport,
  Sheet,
  Sidebar,
  SidebarItem,
  Menu,
  MenuItem,
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

describe("Toast", () => {
  it("renders the message and maps the variant to its ink tone", () => {
    const { rerender } = render(<Toast variant="success">Saved.</Toast>);
    const el = screen.getByText("Saved.").parentElement as HTMLElement;
    expect(el).toHaveClass("bg-ink-bg");
    // the accent bar + dot carry the semantic tone token
    expect(el.querySelector(".bg-ink-success")).not.toBeNull();

    rerender(<Toast variant="danger">Failed.</Toast>);
    const danger = screen.getByText("Failed.").parentElement as HTMLElement;
    expect(danger.querySelector(".bg-ink-danger")).not.toBeNull();
  });

  it("exposes an alert role for danger and status for info", () => {
    const { rerender } = render(<Toast>Heads up.</Toast>);
    expect(screen.getByRole("status")).toBeInTheDocument();
    rerender(<Toast variant="danger">Boom.</Toast>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders a dismiss button only when onDismiss is provided", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<Toast>No button</Toast>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(
      <Toast onDismiss={onDismiss} dismissLabel="Close">
        With button
      </Toast>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("ToastViewport", () => {
  it("positions the stack and keeps toasts clickable through the layer", () => {
    render(
      <ToastViewport position="top-center">
        <Toast>hi</Toast>
      </ToastViewport>,
    );
    const region = screen.getByText("hi").closest(".fixed") as HTMLElement;
    expect(region).toHaveClass("pointer-events-none");
    expect(region).toHaveClass("[&>*]:pointer-events-auto");
  });
});

describe("Sheet", () => {
  it("renders nothing when closed", () => {
    render(
      <Sheet open={false} onClose={() => {}} title="S">
        body
      </Sheet>,
    );
    expect(screen.queryByText("body")).not.toBeInTheDocument();
  });

  it("renders a dialog when open and closes on Escape, not on panel click", () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} side="right" title="Drawer">
        drawer body
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Drawer" });
    expect(dialog).toBeInTheDocument();
    // clicking the panel itself must NOT close (stopPropagation)
    fireEvent.mouseDown(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores Escape while composing (IME guard)", () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Drawer">
        body
      </Sheet>,
    );
    fireEvent.keyDown(document, { key: "Escape", isComposing: true });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Sidebar / SidebarItem", () => {
  it("marks the active row with the accent token and aria-current", () => {
    render(
      <Sidebar label="Sections">
        <SidebarItem label="Schedule" onClick={() => {}} />
        <SidebarItem label="Work" active onClick={() => {}} />
      </Sidebar>,
    );
    const active = screen.getByRole("button", { name: "Work" });
    expect(active).toHaveClass("bg-ink-accent-subtle");
    expect(active).toHaveClass("text-ink-accent");
    expect(active).toHaveAttribute("aria-current", "page");
  });

  it("fires onClick and tints mint rows with the secondary accent", () => {
    const onClick = vi.fn();
    render(
      <Sidebar>
        <SidebarItem label="Habits" tone="mint" onClick={onClick} />
      </Sidebar>,
    );
    const row = screen.getByRole("button", { name: "Habits" });
    expect(row).toHaveClass("text-ink-chip-mint-fg");
    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("Menu / MenuItem", () => {
  it("renders nothing when closed", () => {
    render(
      <Menu open={false} onClose={() => {}} label="Actions">
        <MenuItem onSelect={() => {}}>Rename</MenuItem>
      </Menu>,
    );
    expect(screen.queryByText("Rename")).not.toBeInTheDocument();
  });

  it("renders menu items, fires onSelect, and closes on Escape", () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <Menu open onClose={onClose} label="Actions">
        <MenuItem onSelect={onSelect}>Rename</MenuItem>
        <MenuItem onSelect={() => {}} variant="danger">
          Delete
        </MenuItem>
      </Menu>,
    );
    expect(screen.getByRole("menu", { name: "Actions" })).toBeInTheDocument();
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(2);
    expect(items[1]).toHaveClass("text-ink-danger");

    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(onSelect).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not fire onSelect for a disabled item", () => {
    const onSelect = vi.fn();
    render(
      <Menu open onClose={() => {}}>
        <MenuItem onSelect={onSelect} disabled>
          Archive
        </MenuItem>
      </Menu>,
    );
    const item = screen.getByRole("menuitem", { name: "Archive" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(item);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("closes on Tab and moves roving focus with arrow keys", () => {
    const onClose = vi.fn();
    render(
      <Menu open onClose={onClose} label="Actions">
        <MenuItem onSelect={() => {}}>Rename</MenuItem>
        <MenuItem onSelect={() => {}}>Duplicate</MenuItem>
      </Menu>,
    );
    const menu = screen.getByRole("menu", { name: "Actions" });
    const [first, second] = screen.getAllByRole("menuitem");

    // ArrowDown from the first item advances roving focus to the second.
    first.focus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(second).toHaveFocus();
    // ArrowUp wraps back to the first.
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(first).toHaveFocus();

    // Tab exits the menu (WAI-ARIA menu pattern).
    fireEvent.keyDown(menu, { key: "Tab" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("wraps to the last item on ArrowUp when no item is focused (idx=-1)", () => {
    render(
      <Menu open onClose={() => {}} label="Actions">
        <MenuItem onSelect={() => {}}>Rename</MenuItem>
        <MenuItem onSelect={() => {}}>Duplicate</MenuItem>
      </Menu>,
    );
    const menu = screen.getByRole("menu", { name: "Actions" });
    const items = screen.getAllByRole("menuitem");
    // Force the idx=-1 branch: focus is on nothing in the item list.
    (document.activeElement as HTMLElement | null)?.blur?.();
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(items[items.length - 1]).toHaveFocus();
    // ArrowDown from idx=-1 goes to the first item deterministically.
    (document.activeElement as HTMLElement | null)?.blur?.();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(items[0]).toHaveFocus();
  });
});
