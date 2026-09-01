import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgendaList } from "@life-editor/shared";
import type { ScheduleItem, TodoCalendarChip } from "@life-editor/shared";
import { toAgendaItems } from "../src/schedule/scheduleViewModels";
import { itemTapRoute } from "../src/schedule/todoChipPanel";

/*
 * #1000 — a narrow tap on a Todo row reaches the todo sheet.
 *
 * The surface itself landed in #761 (the sheet) on top of #626 (the panel and
 * its tag editing). What was never pinned is the JOIN between the two halves:
 * the day list builds its rows from `toAgendaItems`, which gives a todo chip a
 * PREFIXED synthetic id, and `itemTapRoute` decides where a tap goes by
 * reading that prefix back. Both halves have their own tests; neither proves
 * they agree, and a rename on either side would send every narrow todo tap
 * down the "select" path — where narrow's stand-in resolves schedule_items
 * only, so the tap would go silently dead again.
 *
 * Asserted through a real render of the shared `AgendaList` rather than
 * through CalendarTab, which needs the whole Provider chain plus real layout
 * (rules/frontend.md §テスト環境の制約). Only the id argument is read: the
 * handler's second argument is a point, and under jsdom every coordinate is 0,
 * so asserting on it would be exactly the coordinate dependence the rules ban.
 *
 * No jest-dom in web/: presence comes from getBy* throwing.
 */

const NOW = new Date(2026, 7, 12, 10, 0, 0);

const event = (over: Partial<ScheduleItem> & { id: string }): ScheduleItem => ({
  date: "2026-08-12",
  title: over.id,
  startTime: "09:00",
  endTime: "10:00",
  completed: false,
  completedAt: null,
  routineId: null,
  templateId: null,
  memo: null,
  noteId: null,
  content: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  ...over,
});

const chip = (
  over: Partial<TodoCalendarChip> & { id: string },
): TodoCalendarChip => ({
  date: "2026-08-12",
  title: over.id,
  startTime: "13:00",
  endTime: "14:00",
  isAllDay: false,
  completed: false,
  ...over,
});

function renderDay() {
  const onItemActivate = vi.fn();
  render(
    <AgendaList
      items={toAgendaItems(
        [event({ id: "s-1", title: "会議" })],
        [chip({ id: "task-1", title: "資料をまとめる" })],
        NOW,
      )}
      onItemActivate={onItemActivate}
      labels={{
        allDay: "All-day",
        empty: "empty",
        todoStatus: "Status",
        todoStatusLabels: {
          statusNotStarted: "Not started",
          statusDone: "Done",
        },
      }}
    />,
  );
  return { onItemActivate };
}

describe("narrow tap on a day-list row (#1000 / #761)", () => {
  it("routes a Todo row to the todo sheet", () => {
    const { onItemActivate } = renderDay();
    fireEvent.click(screen.getByText("資料をまとめる"));

    const id = onItemActivate.mock.calls[0][0] as string;
    expect(id).toBe("todochip-task-1");
    expect(itemTapRoute(id, false)).toBe("todoSheet");
  });

  it("leaves an event row on the select path in the same list", () => {
    // The two row kinds share one handler, which is what broke in #761. This
    // is what keeps them told apart.
    const { onItemActivate } = renderDay();
    fireEvent.click(screen.getByText("会議"));

    const id = onItemActivate.mock.calls[0][0] as string;
    expect(id).toBe("s-1");
    expect(itemTapRoute(id, false)).toBe("select");
  });

  it("keeps Desktop on the select path for both kinds (#626 unchanged)", () => {
    // "Desktop の挙動は不変" as a machine check rather than a sentence: on
    // wide, a todo chip still goes to the #626 overlay via selection.
    expect(itemTapRoute("todochip-task-1", true)).toBe("select");
    expect(itemTapRoute("s-1", true)).toBe("select");
  });
});
