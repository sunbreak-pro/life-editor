import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalendarDataResetDialog } from "./CalendarDataResetDialog";
import type {
  BulkSoftDeleteResult,
  CalendarDataKind,
} from "../../services/DataService";

const bulkSoftDeleteMock = vi.fn<
  [CalendarDataKind[]],
  Promise<BulkSoftDeleteResult>
>();

vi.mock("../../services/dataServiceFactory", () => ({
  getDataService: () => ({
    bulkSoftDeleteCalendarData: bulkSoftDeleteMock,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOpts?: unknown) => {
      if (
        typeof fallbackOrOpts === "object" &&
        fallbackOrOpts !== null &&
        !Array.isArray(fallbackOrOpts)
      ) {
        // i18n-style interpolation key: just return the key for assertion.
        return key;
      }
      return typeof fallbackOrOpts === "string" ? fallbackOrOpts : key;
    },
  }),
}));

const successResult: BulkSoftDeleteResult = {
  tasks: 3,
  events: 1,
  routines: 0,
  cascadedScheduleItems: 0,
  dailies: 0,
  notes: 0,
};

describe("CalendarDataResetDialog", () => {
  beforeEach(() => {
    bulkSoftDeleteMock.mockReset();
    bulkSoftDeleteMock.mockResolvedValue(successResult);
  });

  it("does not render when closed", () => {
    render(<CalendarDataResetDialog open={false} onClose={vi.fn()} />);
    expect(
      screen.queryByRole("dialog", { name: "settings.calendarReset.title" }),
    ).toBeNull();
  });

  it("renders all 5 kind checkboxes when opened", () => {
    render(<CalendarDataResetDialog open onClose={vi.fn()} />);
    expect(
      screen.getByRole("dialog", { name: "settings.calendarReset.title" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
  });

  it("blocks delete when no kind is selected and surfaces a message", async () => {
    const user = userEvent.setup();
    render(<CalendarDataResetDialog open onClose={vi.fn()} />);

    // openButton is shown first; clicking it without selection should fail.
    await user.click(
      screen.getByRole("button", { name: "settings.calendarReset.openButton" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "settings.calendarReset.noSelection",
    );
    expect(bulkSoftDeleteMock).not.toHaveBeenCalled();
  });

  it("selects all then clears via the action buttons", async () => {
    const user = userEvent.setup();
    render(<CalendarDataResetDialog open onClose={vi.fn()} />);

    await user.click(
      screen.getByRole("button", { name: "settings.calendarReset.selectAll" }),
    );
    const checked = screen
      .getAllByRole("checkbox")
      .filter((cb) => (cb as HTMLInputElement).checked);
    expect(checked).toHaveLength(5);

    await user.click(
      screen.getByRole("button", {
        name: "settings.calendarReset.deselectAll",
      }),
    );
    const stillChecked = screen
      .getAllByRole("checkbox")
      .filter((cb) => (cb as HTMLInputElement).checked);
    expect(stillChecked).toHaveLength(0);
  });

  it("requires two clicks to actually trigger the delete (confirm stage)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    render(
      <CalendarDataResetDialog open onClose={onClose} onDeleted={onDeleted} />,
    );

    // pick 'tasks'
    await user.click(
      screen.getByRole("checkbox", {
        name: "settings.calendarReset.kinds.tasks",
      }),
    );

    // first click → confirm stage (no IPC yet)
    await user.click(
      screen.getByRole("button", { name: "settings.calendarReset.openButton" }),
    );
    expect(bulkSoftDeleteMock).not.toHaveBeenCalled();

    // second click → actually deletes
    await user.click(
      screen.getByRole("button", { name: "settings.calendarReset.confirm" }),
    );

    await waitFor(() => {
      expect(bulkSoftDeleteMock).toHaveBeenCalledTimes(1);
    });
    expect(bulkSoftDeleteMock).toHaveBeenCalledWith(["tasks"]);
    expect(onDeleted).toHaveBeenCalledWith(successResult);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("passes the user's selection to the data service", async () => {
    const user = userEvent.setup();
    render(<CalendarDataResetDialog open onClose={vi.fn()} />);

    await user.click(
      screen.getByRole("checkbox", {
        name: "settings.calendarReset.kinds.routines",
      }),
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: "settings.calendarReset.kinds.events",
      }),
    );

    await user.click(
      screen.getByRole("button", { name: "settings.calendarReset.openButton" }),
    );
    await user.click(
      screen.getByRole("button", { name: "settings.calendarReset.confirm" }),
    );

    await waitFor(() => {
      expect(bulkSoftDeleteMock).toHaveBeenCalledTimes(1);
    });
    const calledKinds = bulkSoftDeleteMock.mock.calls[0][0];
    // Order is normalized by the dialog (tasks, events, routines, dailies, notes).
    expect(new Set(calledKinds)).toEqual(new Set(["events", "routines"]));
  });

  it("surfaces backend errors without calling onClose", async () => {
    bulkSoftDeleteMock.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CalendarDataResetDialog open onClose={onClose} />);

    await user.click(
      screen.getByRole("checkbox", {
        name: "settings.calendarReset.kinds.tasks",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "settings.calendarReset.openButton" }),
    );
    await user.click(
      screen.getByRole("button", { name: "settings.calendarReset.confirm" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "settings.calendarReset.failed",
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
