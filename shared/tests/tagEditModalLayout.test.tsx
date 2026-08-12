import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TagEditModal, type TagEditRow } from "../src/components";
import {
  TAG_LABELS,
  mockMatchMedia,
  nameField,
  restoreMatchMedia,
  saveButton,
  selectTagRow,
  typeName,
} from "./tagEditLabels";

/*
 * #740 (ユーザー裁定 D-20260812-tags-1) — the panel is a master–detail pair.
 *
 * Wide: the list and the editor sit side by side, and the editor is empty until
 * a tag is picked. Narrow (phone): the same two panes become two STEPS — the
 * list fills the panel, picking a tag replaces it with the editor, and the
 * editor carries the way back. Stacking two half-height panes on a phone would
 * make both unusable, and side-by-side would need a horizontal scroll (a #740
 * DoD).
 *
 * Width comes from `useMediaQuery`, which falls back to WIDE under jsdom, so the
 * narrow half of the suite stubs `window.matchMedia`.
 */

const ROWS: TagEditRow[] = [
  { id: "tag-1", name: "work", color: null, icon: null, count: 2, items: [] },
  { id: "tag-2", name: "home", color: null, icon: null, count: 0, items: [] },
];

type ModalProps = React.ComponentProps<typeof TagEditModal>;

function props(over: Partial<ModalProps> = {}): ModalProps {
  return {
    open: true,
    onClose: vi.fn(),
    tags: ROWS,
    onCreate: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onSetColor: vi.fn(),
    onSetIcon: vi.fn(),
    onUnassign: vi.fn(),
    formatCount: (count: number) => `${count} items`,
    labels: TAG_LABELS,
    ...over,
  };
}

const listIsOnScreen = () =>
  screen.queryByRole("list", { name: "Tags" }) !== null;
const editorIsOnScreen = () => screen.queryByLabelText("Rename tag") !== null;

afterEach(() => {
  restoreMatchMedia();
});

describe("TagEditModal — two columns on a wide screen (#740)", () => {
  it("shows the list beside a prompt until a tag is picked", () => {
    render(<TagEditModal {...props()} />);

    expect(listIsOnScreen()).toBe(true);
    expect(editorIsOnScreen()).toBe(false);
    expect(screen.getByText(TAG_LABELS.detailEmpty)).toBeInTheDocument();
  });

  it("keeps the list on screen while a tag is being edited", () => {
    render(<TagEditModal {...props()} />);
    selectTagRow("work");

    expect(listIsOnScreen()).toBe(true);
    expect(nameField().value).toBe("work");
    // No back link: the list never left.
    expect(screen.queryByText(TAG_LABELS.backLabel)).toBeNull();
  });

  it("marks the current tag and moves the editor to another one", () => {
    render(<TagEditModal {...props()} />);
    selectTagRow("work");
    expect(
      screen.getByRole("button", { name: "work: 2 items" }),
    ).toHaveAttribute("aria-current", "true");

    selectTagRow("home");
    expect(nameField().value).toBe("home");
    expect(
      screen.getByRole("button", { name: "home: 0 items" }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("button", { name: "work: 2 items" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("falls back to the prompt when the tag being edited is deleted", () => {
    const { rerender } = render(<TagEditModal {...props()} />);
    selectTagRow("work");

    // What the host does after `onDelete`: the row leaves `tags`.
    rerender(<TagEditModal {...props({ tags: [ROWS[1]] })} />);

    expect(editorIsOnScreen()).toBe(false);
    expect(screen.getByText(TAG_LABELS.detailEmpty)).toBeInTheDocument();
  });
});

describe("TagEditModal — two steps on a narrow screen (#740)", () => {
  it("shows the list alone, then the editor alone", () => {
    mockMatchMedia(false);
    render(<TagEditModal {...props()} />);

    expect(listIsOnScreen()).toBe(true);
    expect(editorIsOnScreen()).toBe(false);
    // The wide layout's "pick a tag" prompt has no place here — the list IS
    // the prompt.
    expect(screen.queryByText(TAG_LABELS.detailEmpty)).toBeNull();

    selectTagRow("work");
    expect(listIsOnScreen()).toBe(false);
    expect(nameField().value).toBe("work");
  });

  it("comes back to the list, keeping the draft that was not saved", () => {
    mockMatchMedia(false);
    const onRename = vi.fn();
    render(<TagEditModal {...props({ onRename })} />);

    selectTagRow("work");
    typeName("chores");
    fireEvent.click(screen.getByRole("button", { name: TAG_LABELS.backLabel }));

    // Stepping back loses nothing, so it asks nothing — and the list shows the
    // draft name it is still holding.
    expect(listIsOnScreen()).toBe(true);
    expect(screen.queryByText(TAG_LABELS.switchConfirm)).toBeNull();
    expect(onRename).not.toHaveBeenCalled();

    selectTagRow("chores");
    expect(nameField().value).toBe("chores");
    expect(saveButton()).toBeEnabled();
  });
});
