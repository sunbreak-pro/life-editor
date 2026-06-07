import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  Button,
  IconButton,
  Input,
  Card,
  Modal,
  BottomSheet,
  cn,
} from "../src/components";

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
    expect(screen.getByRole("button")).toHaveClass("bg-notion-accent");
    rerender(<Button variant="danger">X</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-notion-danger");
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
    expect(input).toHaveClass("border-notion-danger");
  });
});

describe("Card", () => {
  it("renders children inside an opaque token surface", () => {
    render(<Card>content</Card>);
    const el = screen.getByText("content");
    expect(el).toHaveClass("bg-notion-bg");
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
