import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgendaList, type AgendaItem } from "../src/components";

/*
 * AgendaList — pure day agenda. All-day rows first, then timed rows in the
 * order given (host sorts). A now-line divider splits past from upcoming when
 * nowMinutes is supplied; the completion circle fires onToggleComplete.
 */

const LABELS = {
  allDay: "All-day",
  empty: "Nothing today",
  nowLabel: "Now",
  complete: "Toggle complete",
};

const ITEMS: AgendaItem[] = [
  {
    id: "allday",
    title: "Trash day",
    startTime: "00:00",
    endTime: "00:00",
    isAllDay: true,
  },
  {
    id: "a",
    title: "Stretch",
    startTime: "07:00",
    endTime: "07:15",
    variant: "routine",
    completed: true,
  },
  {
    id: "b",
    title: "Project review",
    startTime: "15:00",
    endTime: "16:00",
    variant: "event",
  },
];

function renderList(props?: Partial<Parameters<typeof AgendaList>[0]>) {
  const onToggleComplete = vi.fn();
  const onSelectItem = vi.fn();
  render(
    <AgendaList
      items={ITEMS}
      onToggleComplete={onToggleComplete}
      onSelectItem={onSelectItem}
      labels={LABELS}
      {...props}
    />,
  );
  return { onToggleComplete, onSelectItem };
}

describe("AgendaList", () => {
  it("renders all-day badge then timed rows", () => {
    renderList();
    expect(screen.getByText("All-day")).toBeInTheDocument();
    expect(screen.getByText("Trash day")).toBeInTheDocument();
    expect(screen.getByText("Stretch")).toBeInTheDocument();
    expect(screen.getByText("Project review")).toBeInTheDocument();
  });

  it("places the now-line divider between past and upcoming rows", () => {
    renderList({ nowMinutes: 14 * 60 + 30 }); // 14:30
    const past = screen.getByText("Stretch"); // 07:00 → above the line
    const now = screen.getByText("Now");
    const future = screen.getByText("Project review"); // 15:00 → below the line
    // DOM order: past ... now ... future
    expect(
      past.compareDocumentPosition(now) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      now.compareDocumentPosition(future) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("omits the now-line when nowMinutes is null", () => {
    renderList({ nowMinutes: null });
    expect(screen.queryByText("Now")).toBeNull();
  });

  it("trails the now-line after the list when every row is past", () => {
    renderList({ nowMinutes: 23 * 60 }); // 23:00 → both timed rows are past
    const last = screen.getByText("Project review"); // 15:00, final timed row
    const now = screen.getByText("Now");
    expect(
      last.compareDocumentPosition(now) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("leads with the now-line when every row is upcoming", () => {
    renderList({ nowMinutes: 5 * 60 }); // 05:00 → both timed rows upcoming
    const now = screen.getByText("Now");
    const first = screen.getByText("Stretch"); // 07:00, first timed row
    expect(
      now.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("fires onToggleComplete from the completion circle", () => {
    const { onToggleComplete } = renderList();
    const toggles = screen.getAllByRole("button", { name: "Toggle complete" });
    fireEvent.click(toggles[0]);
    expect(onToggleComplete).toHaveBeenCalledWith("a");
  });

  it("shows the empty label when there are no items", () => {
    render(<AgendaList items={[]} labels={LABELS} />);
    expect(screen.getByText("Nothing today")).toBeInTheDocument();
  });
});
