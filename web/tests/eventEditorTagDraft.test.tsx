import { describe, it, expect, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  ToastProvider,
  WikiTagsUnifiedProvider,
  type DataService,
  type WikiTagAssignmentUnified as WikiTagAssignment,
} from "@life-editor/shared";
import { stubDataService, createBumpableSync } from "./helpers";
import {
  ScheduleEventEditor,
  type ScheduleEventEditorProps,
} from "../src/schedule/ScheduleEventEditor";

/*
 * #2447 — 「キャンセル」 on the event editor kept the tag changes.
 *
 * The tag picker wrote each pick on the spot while every other field waited
 * for 「保存」, so cancelling (and answering 「破棄」) took the title back and
 * left the tag on the event. The picks are staged now, like the create panel's
 * tag field (#2220): nothing reaches the DataService until the save press, and
 * a panel that closes without one leaves the event's tags as they were.
 *
 * The real picker under the real Provider: the Schedule suites stub the picker,
 * so they cannot see where its writes go.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  // The event editor's work-time read (#1375). The real factory throws when
  // the app has no Supabase config.
  getDataService: () => ({ fetchSessionsByEventId: async () => [] }),
}));

const { wrapper: SyncWrapper } = createBumpableSync();

const WORK = { id: "tag-work", name: "Work", color: "#1e3a8a", icon: null };
const HOME = { id: "tag-home", name: "Home", color: null, icon: null };

function assignment(id: string, tagId: string): WikiTagAssignment {
  return {
    id,
    itemId: "event-1",
    tagId,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    isDisplayColor: false,
    isDeleted: false,
  } as WikiTagAssignment;
}

function setup(existing: WikiTagAssignment[] = []) {
  const assignTagToItem = vi.fn(
    async (id: string, itemId: string, tagId: string) =>
      ({ ...assignment(id, tagId), itemId }) as WikiTagAssignment,
  );
  const unassignTagFromItem = vi.fn(async () => undefined);
  const ds = stubDataService({
    listAllWikiTagsUnified: async () => [{ ...WORK }, { ...HOME }],
    listAllTagConnections: async () => [],
    listAllTagAssignments: async () => existing,
    assignTagToItem,
    unassignTagFromItem,
  }) as DataService;
  const onDirtyChange = vi.fn();
  const props: ScheduleEventEditorProps = {
    item: {
      id: "event-1",
      title: "打ち合わせ",
      date: "2026-08-20",
      startTime: "10:00",
      endTime: "11:00",
      isAllDay: false,
      memo: "",
      isRoutine: false,
    },
    isWide: true,
    handlers: { onSave: vi.fn(), onDirtyChange },
    options: { canEditDate: true, canEditAllDay: true },
    repeat: {
      value: null,
      weekdayLabels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      labels: {
        frequency: "frequency",
        frequencyDaily: "frequencyDaily",
        frequencyWeekdays: "frequencyWeekdays",
        frequencyInterval: "frequencyInterval",
        intervalEvery: "intervalEvery",
        intervalDays: "intervalDays",
        startDate: "startDate",
      },
      onChange: vi.fn(),
    },
    onConvertToTodo: vi.fn(),
  };
  const utils = render(
    <SyncWrapper>
      <ToastProvider>
        <WikiTagsUnifiedProvider dataService={ds}>
          <ScheduleEventEditor {...props} />
        </WikiTagsUnifiedProvider>
      </ToastProvider>
    </SyncWrapper>,
  );
  return { ...utils, assignTagToItem, unassignTagFromItem, onDirtyChange };
}

async function pick(name: string) {
  const trigger = await screen.findByRole("button", { name: "Add tag" });
  await act(async () => {
    fireEvent.click(trigger);
  });
  const row = (await screen.findByText(name)).closest("button");
  if (!row) throw new Error(`no candidate row for ${name}`);
  await act(async () => {
    fireEvent.click(row);
  });
}

const saveButton = () =>
  screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;

describe("event editor tags wait for Save (#2447)", () => {
  it("shows a picked tag without writing it, and marks the draft unsaved", async () => {
    const { assignTagToItem, onDirtyChange } = setup();
    await pick("Work");

    expect(screen.getByRole("button", { name: "Remove tag Work" })).toBeTruthy();
    expect(assignTagToItem).not.toHaveBeenCalled();
    // The host's discard question reads this flag, so Cancel asks first.
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    // A tag-only change is something Save can commit.
    expect(saveButton().disabled).toBe(false);
  });

  it("writes nothing when the panel closes without a save", async () => {
    const { assignTagToItem, unmount } = setup();
    await pick("Work");

    // What the discard answer does: the frame takes the panel down.
    unmount();
    expect(assignTagToItem).not.toHaveBeenCalled();
  });

  it("writes the picked tag from the save press", async () => {
    const { assignTagToItem, onDirtyChange } = setup();
    await pick("Work");

    await act(async () => {
      fireEvent.click(saveButton());
    });

    await waitFor(() =>
      expect(assignTagToItem).toHaveBeenCalledExactlyOnceWith(
        expect.any(String),
        "event-1",
        "tag-work",
      ),
    );
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    expect(screen.getByRole("button", { name: "Remove tag Work" })).toBeTruthy();
  });

  it("stages a removal too, and sends it on save", async () => {
    const { unassignTagFromItem } = setup([assignment("assign-1", "tag-work")]);
    const remove = await screen.findByRole("button", { name: "Remove tag Work" });

    await act(async () => {
      fireEvent.click(remove);
    });
    expect(screen.queryByRole("button", { name: "Remove tag Work" })).toBeNull();
    expect(unassignTagFromItem).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(saveButton());
    });
    await waitFor(() =>
      expect(unassignTagFromItem).toHaveBeenCalledExactlyOnceWith("assign-1"),
    );
  });

  it("is not dirty when a pick is taken back before saving", async () => {
    const { onDirtyChange } = setup();
    await pick("Work");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove tag Work" }));
    });

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(saveButton().disabled).toBe(true);
  });
});
