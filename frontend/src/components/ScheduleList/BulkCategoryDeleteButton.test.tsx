import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BulkCategoryDeleteButton } from "./BulkCategoryDeleteButton";
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
        return key;
      }
      return typeof fallbackOrOpts === "string" ? fallbackOrOpts : key;
    },
  }),
}));

const result: BulkSoftDeleteResult = {
  tasks: 0,
  events: 5,
  routines: 0,
  cascadedScheduleItems: 0,
  dailies: 0,
  notes: 0,
};

describe("BulkCategoryDeleteButton", () => {
  beforeEach(() => {
    bulkSoftDeleteMock.mockReset();
    bulkSoftDeleteMock.mockResolvedValue(result);
  });

  it("labels the button by kind", () => {
    render(<BulkCategoryDeleteButton kind="events" />);
    expect(
      screen.getByRole("button", { name: "schedule.bulkDelete.events" }),
    ).toBeInTheDocument();
  });

  it("requires two clicks before invoking the IPC (confirm stage)", async () => {
    const user = userEvent.setup();
    render(<BulkCategoryDeleteButton kind="events" />);
    const btn = screen.getByRole("button", {
      name: "schedule.bulkDelete.events",
    });

    await user.click(btn);
    expect(bulkSoftDeleteMock).not.toHaveBeenCalled();
    expect(btn).toHaveTextContent("schedule.bulkDelete.confirm");

    await user.click(btn);
    await waitFor(() => {
      expect(bulkSoftDeleteMock).toHaveBeenCalledTimes(1);
    });
    expect(bulkSoftDeleteMock).toHaveBeenCalledWith(["events"]);
  });

  it("passes only its own kind (routines) to the data service", async () => {
    const user = userEvent.setup();
    render(<BulkCategoryDeleteButton kind="routines" />);
    const btn = screen.getByRole("button", {
      name: "schedule.bulkDelete.routines",
    });

    await user.click(btn);
    await user.click(btn);

    await waitFor(() => {
      expect(bulkSoftDeleteMock).toHaveBeenCalledWith(["routines"]);
    });
  });

  it("surfaces backend errors and returns to idle", async () => {
    bulkSoftDeleteMock.mockRejectedValueOnce("no such table: foo");
    const user = userEvent.setup();
    render(<BulkCategoryDeleteButton kind="events" />);
    const btn = screen.getByRole("button", {
      name: "schedule.bulkDelete.events",
    });

    await user.click(btn);
    await user.click(btn);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "schedule.bulkDelete.failed",
    );
    // back to idle label after failure
    expect(btn).toHaveTextContent("schedule.bulkDelete.events");
  });
});
