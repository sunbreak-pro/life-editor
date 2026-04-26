import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { TimerSession } from "../../../../types/timer";
import { TIME_GRID } from "../../../../constants/timeGrid";
import { SessionBlock } from "./SessionBlock";

function makeSession(overrides: Partial<TimerSession>): TimerSession {
  return {
    id: 1,
    taskId: null,
    sessionType: "WORK",
    startedAt: new Date("2026-04-26T09:00:00"),
    completedAt: new Date("2026-04-26T09:25:00"),
    duration: 25 * 60,
    completed: true,
    label: null,
    ...overrides,
  };
}

describe("SessionBlock", () => {
  it("renders nothing when startedAt is null", () => {
    const { container } = render(
      <SessionBlock
        session={makeSession({ startedAt: null as unknown as Date })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when duration and completedAt are both missing", () => {
    const { container } = render(
      <SessionBlock
        session={makeSession({ duration: null, completedAt: null })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("computes top position from startedAt time", () => {
    const { container } = render(
      <SessionBlock
        session={makeSession({
          startedAt: new Date("2026-04-26T09:30:00"),
        })}
      />,
    );
    const el = container.firstChild as HTMLDivElement;
    // 9.5 hours after START_HOUR=0 → 9.5 * SLOT_HEIGHT(60) = 570
    const expectedTop = (9 * 60 + 30) / 60 - TIME_GRID.START_HOUR;
    expect(el.style.top).toBe(`${expectedTop * TIME_GRID.SLOT_HEIGHT}px`);
  });

  it("computes height from duration in seconds", () => {
    const { container } = render(
      <SessionBlock
        session={makeSession({
          duration: 1800, // 30 minutes
          completedAt: null,
        })}
      />,
    );
    const el = container.firstChild as HTMLDivElement;
    // 30min / 60min/hr * SLOT_HEIGHT(60) = 30
    expect(el.style.height).toBe("30px");
  });

  it("falls back to completedAt - startedAt when duration is null", () => {
    const { container } = render(
      <SessionBlock
        session={makeSession({
          duration: null,
          startedAt: new Date("2026-04-26T10:00:00"),
          completedAt: new Date("2026-04-26T10:45:00"),
        })}
      />,
    );
    const el = container.firstChild as HTMLDivElement;
    // 45min / 60 * 60 = 45
    expect(el.style.height).toBe("45px");
  });

  it("enforces minimum height of 4px for very short sessions", () => {
    const { container } = render(
      <SessionBlock
        session={makeSession({
          duration: 60, // 1 min → 1px height, clamped to 4
          completedAt: null,
        })}
      />,
    );
    const el = container.firstChild as HTMLDivElement;
    expect(el.style.height).toBe("4px");
  });

  it("uses WORK color class for WORK session", () => {
    const { container } = render(
      <SessionBlock session={makeSession({ sessionType: "WORK" })} />,
    );
    const el = container.firstChild as HTMLDivElement;
    expect(el.className).toContain("bg-rose-400/45");
  });

  it("uses BREAK color class for BREAK session", () => {
    const { container } = render(
      <SessionBlock session={makeSession({ sessionType: "BREAK" })} />,
    );
    const el = container.firstChild as HTMLDivElement;
    expect(el.className).toContain("bg-emerald-400/35");
  });

  it("uses FREE color class for FREE session", () => {
    const { container } = render(
      <SessionBlock session={makeSession({ sessionType: "FREE" })} />,
    );
    const el = container.firstChild as HTMLDivElement;
    expect(el.className).toContain("bg-violet-400/35");
  });

  it("renders title with label when provided", () => {
    const { container } = render(
      <SessionBlock
        session={makeSession({ label: "Deep work" })}
        taskTitle="Some task"
      />,
    );
    const el = container.firstChild as HTMLDivElement;
    expect(el.title).toContain("Deep work");
  });

  it("falls back to taskTitle when label is empty", () => {
    const { container } = render(
      <SessionBlock
        session={makeSession({ label: null })}
        taskTitle="Some task"
      />,
    );
    const el = container.firstChild as HTMLDivElement;
    expect(el.title).toContain("Some task");
  });

  it("falls back to session type label when no label or task title", () => {
    const { container } = render(
      <SessionBlock
        session={makeSession({ sessionType: "LONG_BREAK", label: null })}
      />,
    );
    const el = container.firstChild as HTMLDivElement;
    expect(el.title).toContain("Long break");
  });

  it("accepts ISO string startedAt and parses correctly", () => {
    const { container } = render(
      <SessionBlock
        session={makeSession({
          startedAt: "2026-04-26T08:00:00" as unknown as Date,
          duration: 1800,
        })}
      />,
    );
    const el = container.firstChild as HTMLDivElement;
    expect(el.style.top).toBe(`${8 * TIME_GRID.SLOT_HEIGHT}px`);
  });

  it("includes start time in tooltip", () => {
    const { container } = render(
      <SessionBlock
        session={makeSession({
          startedAt: new Date("2026-04-26T14:05:00"),
        })}
      />,
    );
    const el = container.firstChild as HTMLDivElement;
    expect(el.title).toContain("14:05");
  });

  it("includes duration minutes in tooltip", () => {
    const { container } = render(
      <SessionBlock
        session={makeSession({
          duration: 25 * 60, // 25 min
        })}
      />,
    );
    const el = container.firstChild as HTMLDivElement;
    expect(el.title).toContain("25m");
  });
});
