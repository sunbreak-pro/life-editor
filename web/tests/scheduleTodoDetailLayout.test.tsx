import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { TodoNode } from "@life-editor/shared";
import { ScheduleTodoDetail } from "../src/schedule/ScheduleTodoDetail";
import type { ScheduleTodoDetailProps } from "../src/schedule/ScheduleTodoDetail";

/*
 * #2553 — the todo detail takes the event editor's two columns, and the status
 * is the two-choice row on Desktop as well. The logged-time field #2553 also
 * brought was removed by #2718; this suite pins that it stays gone.
 *
 * `useTranslation` echoes keys; TagPicker / TagColorControls / the editor are
 * stubbed as in scheduleTodoDetail.test.tsx. No jest-dom in web/.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "ja" } }),
  useGoalLinkSnapshot: () => ({ state: null, writeLinks: async () => {} }),
}));

vi.mock("../src/notes/LazyRichTextEditor", () => ({
  LazyRichTextEditor: () => <div data-testid="editor" />,
}));
vi.mock("../src/wikitag/TagPicker", () => ({
  TagPicker: ({ itemId }: { itemId: string }) => (
    <div data-testid="tag-picker">{itemId}</div>
  ),
}));
vi.mock("../src/wikitag/TagColorControls", () => ({
  TagColorControls: ({ itemId }: { itemId: string }) => (
    <span data-testid="tag-colors">{itemId}</span>
  ),
}));

const TODO: TodoNode = {
  id: "task-1",
  type: "task",
  title: "資料をまとめる",
  parentId: null,
  order: 0,
  status: "NOT_STARTED",
  createdAt: "2026-08-16T00:00:00.000Z",
};

function renderDetail(over: Partial<ScheduleTodoDetailProps> = {}) {
  const setStatus = vi.fn();
  const updateNode = vi.fn();
  const props: ScheduleTodoDetailProps = {
    todoId: TODO.id,
    todoNodes: [TODO],
    isWide: true,
    onClose: vi.fn(),
    writes: {
      updateNode,
      toggleStatus: vi.fn(),
      setStatus,
      onDelete: vi.fn(),
    },
    onConvertToEvent: vi.fn(),
    linking: {
      loadLinkTargets: vi.fn(),
      handleResolvedLinkInserted: vi.fn(),
      handleBodySaved: vi.fn(),
    } as unknown as ScheduleTodoDetailProps["linking"],
    askConfirm: vi.fn(() => Promise.resolve(true)),
    ...over,
  };
  render(<ScheduleTodoDetail {...props} />);
  return { setStatus, updateNode };
}

const saveButton = () =>
  screen.getByRole("button", { name: "todoDetail.save" }) as HTMLButtonElement;

describe("ScheduleTodoDetail — the event editor's layout (#2553)", () => {
  it("lays Desktop out in two columns, the sheet in one", () => {
    renderDetail({ isWide: true });
    expect(
      document.querySelector('[data-editor-column="identity"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-editor-column="attachments"]'),
    ).not.toBeNull();
  });

  it("keeps the sheet in one column", () => {
    renderDetail({ isWide: false });
    expect(document.querySelector("[data-editor-column]")).toBeNull();
  });

  it.each([
    ["Desktop", true],
    ["Mobile", false],
  ])("offers the two-choice status on %s", (_name, isWide) => {
    const { setStatus } = renderDetail({ isWide });
    const group = screen.getByRole("group", {
      name: "materials.todos.statusGroupLabel",
    });
    expect(group).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "todoDetail.statusDone" }),
    );
    expect(setStatus).toHaveBeenCalledWith(TODO.id, "DONE");
  });

  it("puts 予定に変換 above the footer, under both columns", () => {
    renderDetail({ isWide: true });
    const convert = screen.getByRole("button", { name: "itemConvert.toEvent" });
    expect(convert.closest("[data-editor-column]")).toBeNull();
    expect(
      convert.compareDocumentPosition(saveButton()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  // #2718: the logged-time field is gone from the todo on both widths.
  it.each([
    ["Desktop", true],
    ["Mobile", false],
  ])("shows no logged-time field on %s", (_name, isWide) => {
    renderDetail({ isWide });
    expect(screen.queryByLabelText("scheduleScreen.workTime")).toBeNull();
    expect(screen.queryByText("scheduleScreen.workTime")).toBeNull();
  });
});
