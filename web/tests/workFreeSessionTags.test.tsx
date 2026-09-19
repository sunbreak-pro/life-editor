import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import type { Mock } from "vitest";
import { TimerProvider, type DataService } from "@life-editor/shared";
import { stubDataService, createBumpableSync } from "./helpers";
import { WorkScreen } from "../src/work/WorkScreen";

/*
 * #1665 — the tag field beside the link-target selector.
 *
 * The Provider half (when an Event is minted, with which range and tags) lives
 * in shared/tests/timerFreeSession. What is pinned here is the screen half:
 * the field is next to the picker, a tag chosen there reaches the timer's free
 * session selection, a new name creates a tag, and picking a link target
 * disables the field — no free session will be minted then, so its tags would
 * go nowhere.
 */

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts ? `${key}|${Object.values(opts).join(",")}` : key,
      i18n: { language: "en" },
    }),
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

function makeHarness(): { ds: DataService; fns: Record<string, Mock> } {
  const fns: Record<string, Mock> = {
    fetchTimerSettings: vi.fn(async () => ({
      workDuration: 25,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
      autoStartBreaks: false,
      targetSessions: 4,
    })),
    fetchPomodoroPresets: vi.fn(async () => []),
    fetchTodoTree: vi.fn(async () => [
      { id: "task-1", type: "task", title: "Write the spec", isDeleted: false },
    ]),
    fetchScheduleItemsByDateRange: vi.fn(async () => []),
    listAllWikiTagsUnified: vi.fn(async () => [
      {
        id: "tag-1",
        name: "writing",
        color: null,
        icon: null,
        isDeleted: false,
      },
      {
        id: "tag-x",
        name: "retired",
        color: null,
        icon: null,
        isDeleted: true,
      },
    ]),
    createWikiTagUnified: vi.fn(async (id: string, name: string) => ({
      id,
      name,
      color: null,
      icon: null,
      isDeleted: false,
    })),
    startTimerSession: vi.fn(async () => ({ id: 1 })),
    endTimerSession: vi.fn(async () => undefined),
  };
  return { ds: stubDataService(fns) as DataService, fns };
}

const { wrapper: SyncWrapper } = createBumpableSync();

async function renderWork() {
  const harness = makeHarness();
  render(
    <SyncWrapper>
      <TimerProvider dataService={harness.ds} freeSessionTitle="Free session">
        <WorkScreen dataService={harness.ds} />
      </TimerProvider>
    </SyncWrapper>,
  );
  await screen.findByRole("button", { name: "work.controls.reset" });
  await waitFor(() =>
    expect(harness.fns.listAllWikiTagsUnified).toHaveBeenCalled(),
  );
  return harness;
}

/** The desktop field — the mobile one is behind the width query. */
const field = () => screen.getAllByTestId("work-tag-selector")[0];

const openField = () =>
  fireEvent.click(
    within(field()).getByRole("button", { name: "work.freeSession.tagAdd" }),
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Work free-session tags (#1665)", () => {
  it("offers the live tags and keeps a deleted one out", async () => {
    await renderWork();
    openField();

    const dialog = await screen.findByRole("dialog", {
      name: "work.freeSession.tagDialog",
    });
    within(dialog).getByText("writing");
    expect(within(dialog).queryByText("retired")).toBeNull();
  });

  it("puts a chosen tag on the field as a pill", async () => {
    await renderWork();
    openField();
    fireEvent.click(
      within(
        await screen.findByRole("dialog", {
          name: "work.freeSession.tagDialog",
        }),
      ).getByText("writing"),
    );

    within(field()).getByText("writing");
  });

  it("creates a tag from a name that does not exist yet", async () => {
    const { fns } = await renderWork();
    openField();
    const dialog = await screen.findByRole("dialog", {
      name: "work.freeSession.tagDialog",
    });
    fireEvent.change(
      within(dialog).getByPlaceholderText("work.freeSession.tagSearch"),
      {
        target: { value: "deep work" },
      },
    );
    fireEvent.click(
      within(dialog).getByText("work.freeSession.tagCreate|deep work"),
    );

    await waitFor(() =>
      expect(fns.createWikiTagUnified).toHaveBeenCalledTimes(1),
    );
    const [id, name, color] = fns.createWikiTagUnified.mock.calls[0];
    expect(String(id).startsWith("tag-")).toBe(true);
    expect([name, color]).toEqual(["deep work", null]);
    await waitFor(() => within(field()).getByText("deep work"));
  });

  it("disables the field once a link target is picked", async () => {
    await renderWork();
    fireEvent.click(
      screen.getByRole("button", { name: "work.todoSelector.placeholder" }),
    );
    fireEvent.click(
      within(await screen.findByRole("menu")).getByText("Write the spec"),
    );

    const add = within(field()).getByRole("button", {
      name: "work.freeSession.tagAdd",
    }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.click(add);
    expect(
      screen.queryByRole("dialog", { name: "work.freeSession.tagDialog" }),
    ).toBeNull();
  });
});
