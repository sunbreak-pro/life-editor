import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventList } from "./EventList";
import type { ScheduleItem } from "../../types/schedule";

const mockToggleComplete = vi.fn();
const mockLoadEvents = vi.fn();

const baseEvent: ScheduleItem = {
  id: "event-1",
  date: "2026-04-05",
  title: "Test Event",
  startTime: "10:00",
  endTime: "11:00",
  completed: false,
  completedAt: null,
  routineId: null,
  templateId: null,
  memo: null,
  noteId: null,
  content: null,
  isDismissed: false,
  isAllDay: false,
  createdAt: "2026-04-05T00:00:00Z",
  updatedAt: "2026-04-05T00:00:00Z",
};

let mockEvents: ScheduleItem[] = [];

vi.mock("../../hooks/useScheduleItemsContext", () => ({
  useScheduleItemsContext: () => ({
    events: mockEvents,
    loadEvents: mockLoadEvents,
    eventsVersion: 0,
    toggleComplete: mockToggleComplete,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => fallback,
  }),
}));

describe("EventList", () => {
  const defaultProps = {
    selectedEventId: null,
    onSelectEvent: vi.fn(),
    filter: "incomplete" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEvents = [];
  });

  describe("DOM structure", () => {
    it("does not render nested <button> elements", () => {
      mockEvents = [baseEvent];
      const { container } = render(<EventList {...defaultProps} />);

      const buttons = container.querySelectorAll("button");
      for (const button of buttons) {
        const nestedButtons = button.querySelectorAll("button");
        expect(nestedButtons.length).toBe(0);
      }
    });

    it("renders event rows with role='button' and tabIndex=0", () => {
      mockEvents = [baseEvent];
      render(<EventList {...defaultProps} />);

      const rows = screen.getAllByRole("button");
      // First role="button" is the row div, second is the inner toggle button
      const rowDiv = rows[0];
      expect(rowDiv.tagName).not.toBe("BUTTON");
      expect(rowDiv).toHaveAttribute("tabindex", "0");
    });

    it("renders inner toggle as a real <button>", () => {
      mockEvents = [baseEvent];
      const { container } = render(<EventList {...defaultProps} />);

      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBe(1);
      expect(buttons[0].tagName).toBe("BUTTON");
    });
  });

  describe("interactions", () => {
    it("calls onSelectEvent when clicking an event row", async () => {
      mockEvents = [baseEvent];
      const onSelectEvent = vi.fn();
      render(<EventList {...defaultProps} onSelectEvent={onSelectEvent} />);

      const rows = screen.getAllByRole("button");
      await userEvent.click(rows[0]);

      expect(onSelectEvent).toHaveBeenCalledWith("event-1");
    });

    it("calls onSelectEvent on Enter key", async () => {
      mockEvents = [baseEvent];
      const onSelectEvent = vi.fn();
      render(<EventList {...defaultProps} onSelectEvent={onSelectEvent} />);

      const rows = screen.getAllByRole("button");
      rows[0].focus();
      await userEvent.keyboard("{Enter}");

      expect(onSelectEvent).toHaveBeenCalledWith("event-1");
    });

    it("calls onSelectEvent on Space key", async () => {
      mockEvents = [baseEvent];
      const onSelectEvent = vi.fn();
      render(<EventList {...defaultProps} onSelectEvent={onSelectEvent} />);

      const rows = screen.getAllByRole("button");
      rows[0].focus();
      await userEvent.keyboard(" ");

      expect(onSelectEvent).toHaveBeenCalledWith("event-1");
    });

    it("calls toggleComplete without triggering onSelectEvent when clicking the toggle button", async () => {
      mockEvents = [baseEvent];
      const onSelectEvent = vi.fn();
      const { container } = render(
        <EventList {...defaultProps} onSelectEvent={onSelectEvent} />,
      );

      const toggleButton = container.querySelector("button")!;
      await userEvent.click(toggleButton);

      expect(mockToggleComplete).toHaveBeenCalledWith("event-1");
      expect(onSelectEvent).not.toHaveBeenCalled();
    });
  });

  describe("filtering", () => {
    const completedEvent: ScheduleItem = {
      ...baseEvent,
      id: "event-2",
      title: "Completed Event",
      completed: true,
    };

    it("shows only incomplete events when filter='incomplete'", () => {
      mockEvents = [baseEvent, completedEvent];
      render(<EventList {...defaultProps} filter="incomplete" />);

      expect(screen.getByText("Test Event")).toBeInTheDocument();
      expect(screen.queryByText("Completed Event")).not.toBeInTheDocument();
    });

    it("shows only completed events when filter='completed'", () => {
      mockEvents = [baseEvent, completedEvent];
      render(<EventList {...defaultProps} filter="completed" />);

      expect(screen.queryByText("Test Event")).not.toBeInTheDocument();
      expect(screen.getByText("Completed Event")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows empty message when no events match the filter", () => {
      mockEvents = [];
      render(<EventList {...defaultProps} />);

      expect(screen.getByText("No events")).toBeInTheDocument();
    });
  });

  describe("display", () => {
    it("shows startTime for non-allDay events", () => {
      mockEvents = [baseEvent];
      render(<EventList {...defaultProps} />);

      expect(screen.getByText("10:00")).toBeInTheDocument();
    });

    it("does not show startTime for allDay events", () => {
      mockEvents = [{ ...baseEvent, isAllDay: true }];
      render(<EventList {...defaultProps} />);

      expect(screen.queryByText("10:00")).not.toBeInTheDocument();
    });

    it("applies line-through style to completed events", () => {
      mockEvents = [{ ...baseEvent, completed: true }];
      render(<EventList {...defaultProps} filter="completed" />);

      const titleSpan = screen.getByText("Test Event");
      expect(titleSpan.className).toContain("line-through");
    });
  });
});
