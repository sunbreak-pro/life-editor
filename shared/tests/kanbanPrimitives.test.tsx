import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KanbanCard, KanbanColumn } from "../src/components";
import type {
  KanbanCardModel,
  KanbanColumnModel,
  KanbanLabels,
} from "../src/components";

/*
 * Materials Step 2 — design-alignment tweaks to the shared Kanban leaves:
 *   - KanbanCard tag chips are now neutral bg-secondary pills carrying a 6px
 *     color dot (not a color-tinted fill), and still collapse past 3 into +N.
 *   - KanbanColumn shows a centered empty hint when a column has no cards, and
 *     an accent-colored count badge otherwise.
 * These render tests pin the observable behaviour (text + a11y), not classes.
 */

const LABELS: KanbanLabels = {
  viewStatus: "By status",
  viewTag: "By tag",
  segmentedGroupLabel: "Switch view",
  statusNotStarted: "Not started",
  statusInProgress: "In progress",
  statusDone: "Done",
  cardAriaLabel: (title, statusText) => `${title} — ${statusText}`,
  emptyColumn: "No tasks here yet",
  placeholderHint: "Coming soon",
  countAriaLabel: (n) => `${n} tasks`,
  untagged: "No tag",
  colorPickerLabel: "Change color",
  colorClearLabel: "Default",
  colorCustomLabel: "Custom",
};

function makeCard(over: Partial<KanbanCardModel> = {}): KanbanCardModel {
  return {
    id: "task-1",
    title: "Write the plan",
    status: "NOT_STARTED",
    ...over,
  };
}

describe("KanbanCard (Materials Step 2)", () => {
  it("renders the title, status chip label and tag names", () => {
    render(
      <KanbanCard
        card={makeCard({
          tags: [
            { id: "t1", name: "review", color: "#2563eb" },
            { id: "t2", name: "urgent" },
          ],
        })}
        labels={LABELS}
        showTags
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Write the plan")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
    expect(screen.getByText("review")).toBeInTheDocument();
    expect(screen.getByText("urgent")).toBeInTheDocument();
  });

  it("collapses more than three tags into a +N overflow chip", () => {
    render(
      <KanbanCard
        card={makeCard({
          tags: [
            { id: "t1", name: "a" },
            { id: "t2", name: "b" },
            { id: "t3", name: "c" },
            { id: "t4", name: "d" },
          ],
        })}
        labels={LABELS}
        showTags
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.queryByText("d")).not.toBeInTheDocument();
  });

  it("fires onSelect with the card id when clicked", () => {
    const onSelect = vi.fn();
    render(
      <KanbanCard card={makeCard()} labels={LABELS} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("task-1");
  });
});

function makeColumn(over: Partial<KanbanColumnModel> = {}): KanbanColumnModel {
  return { id: "col-1", title: "Work", cards: [], ...over };
}

describe("KanbanColumn (Materials Step 2)", () => {
  it("shows the empty hint when the column has no cards", () => {
    render(
      <KanbanColumn
        column={makeColumn()}
        labels={LABELS}
        onSelectCard={() => {}}
      />,
    );
    expect(screen.getByText("No tasks here yet")).toBeInTheDocument();
  });

  it("shows the card count badge when the column has cards", () => {
    render(
      <KanbanColumn
        column={makeColumn({ cards: [makeCard(), makeCard({ id: "task-2" })] })}
        labels={LABELS}
        onSelectCard={() => {}}
      />,
    );
    // countAriaLabel("2 tasks") is the accessible name of the count badge.
    expect(screen.getByLabelText("2 tasks")).toHaveTextContent("2");
  });
});
