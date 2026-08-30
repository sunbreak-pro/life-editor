import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import type { Mock } from "vitest";
import {
  ScheduleRestoreConflictError,
  type DataService,
} from "@life-editor/shared";
import { TrashScreen } from "../src/trash/TrashScreen";
import { createBumpableSync } from "./helpers";

/*
 * #701 Step 2 — one screen driven entirely through its buttons' ARGUMENTS.
 *
 * D-20260812-refactor-2 settled the route as A+B: render the real screen with
 * Testing Library and drive its handlers (B), and only fall back to extracting
 * a pure module (A) when the component cannot live in jsdom at all. Trash is
 * the demonstration screen — it is not Schedule (#701 reserves Schedule for
 * #673/#675), it needs one Provider (Sync — #1157 put the five reads on
 * useDomainLoad, which follows the Realtime counters), and every one of its
 * buttons ends in
 * a DataService call whose ARGUMENT is the whole behavior.
 *
 * What that buys over the existing suites: shared/tests/trashView.test.tsx
 * pins the presentation (which button, which dialog, which busy chip) with
 * `vi.fn()` callbacks, so it is blind to the host wiring underneath — the two
 * switch statements at the bottom of TrashScreen.tsx that decide WHICH of the
 * ten service methods a click reaches. A copy-paste slip there (notes routed to
 * restoreTodo) leaves every existing test green while the wrong row comes back
 * from the trash. The routing tables below are that missing assertion: for each
 * of the five categories, click the button and assert both the method that fired
 * and the id it carried, plus that no sibling method fired at all.
 *
 * No jest-dom in web/ — presence comes from getBy* throwing, absence from
 * queryBy* being null (same convention as mobileShellActions.test.tsx).
 */

interface CategorySpec {
  /** Section heading the host resolves through i18n (en catalog). */
  region: string;
  fetch: string;
  restore: string;
  remove: string;
  /** Rows the fake service hands back for this category. */
  rows: Record<string, string>[];
  /** The row every routing case acts on, with the label the host must show. */
  target: { id: string; label: string };
}

const CATEGORIES: CategorySpec[] = [
  {
    region: "Todos",
    fetch: "fetchDeletedTodos",
    restore: "restoreTodo",
    remove: "permanentDeleteTodo",
    rows: [
      { id: "task-1", title: "Buy milk" },
      // Empty title — pins the host's `|| Untitled` fallback.
      { id: "task-2", title: "" },
    ],
    target: { id: "task-1", label: "Buy milk" },
  },
  {
    region: "Notes",
    fetch: "fetchDeletedNotesUnified",
    restore: "restoreNoteUnified",
    remove: "permanentDeleteNoteUnified",
    rows: [{ id: "note-1", title: "Design memo" }],
    target: { id: "note-1", label: "Design memo" },
  },
  {
    region: "Dailies",
    fetch: "fetchDeletedDailiesUnified",
    restore: "restoreDailyUnified",
    remove: "permanentDeleteDailyUnified",
    // Dailies are the one category labeled by `date`, not `title`.
    rows: [{ id: "daily-2026-08-12", date: "2026-08-12" }],
    target: { id: "daily-2026-08-12", label: "2026-08-12" },
  },
  {
    region: "Routines",
    fetch: "fetchDeletedRoutines",
    restore: "restoreRoutine",
    remove: "permanentDeleteRoutine",
    rows: [{ id: "routine-1", title: "Morning stretch" }],
    target: { id: "routine-1", label: "Morning stretch" },
  },
  {
    region: "Events",
    fetch: "fetchDeletedScheduleItems",
    restore: "restoreScheduleItem",
    remove: "permanentDeleteScheduleItem",
    rows: [{ id: "event-1", title: "Dentist" }],
    target: { id: "event-1", label: "Dentist" },
  },
];

/** Every method a click can reach — the pool "no sibling fired" checks. */
const ACTION_METHODS = CATEGORIES.flatMap((c) => [c.restore, c.remove]);

interface Harness {
  ds: DataService;
  fns: Record<string, Mock>;
}

/*
 * Fake DataService that actually forgets a row once it is restored or deleted,
 * so the post-action re-fetch has something to prove: the list the user ends up
 * looking at is the one the service returned AFTER the write, not the stale one.
 */
function makeHarness(): Harness {
  const rows = new Map<string, Record<string, string>[]>(
    CATEGORIES.map((c) => [c.region, c.rows.map((r) => ({ ...r }))]),
  );
  const drop = (region: string, id: string) => {
    rows.set(
      region,
      rows.get(region)!.filter((r) => r.id !== id),
    );
  };
  const fns: Record<string, Mock> = {};
  for (const c of CATEGORIES) {
    fns[c.fetch] = vi.fn(async () =>
      rows.get(c.region)!.map((r) => ({ ...r })),
    );
    fns[c.restore] = vi.fn(async (id: string) => drop(c.region, id));
    fns[c.remove] = vi.fn(async (id: string) => drop(c.region, id));
  }
  return { ds: fns as unknown as DataService, fns };
}

/*
 * TrashScreen reads `useSyncDomains` since #1157, and `useSyncContext` throws
 * outside its Provider — so every render here goes through one. `bump` is
 * unused by these tests; what matters is that the counter exists and never
 * moves, so nothing refetches behind an assertion.
 */
function renderInSync(harness: Harness) {
  const { wrapper } = createBumpableSync();
  render(<TrashScreen dataService={harness.ds} />, { wrapper });
}

/** Renders and waits out the loading skeleton. */
async function renderTrash(): Promise<Harness> {
  const harness = makeHarness();
  renderInSync(harness);
  await screen.findByRole("region", { name: "Todos" });
  return harness;
}

function row(region: string, label: string): HTMLElement {
  const section = screen.getByRole("region", { name: region });
  const li = within(section).getByText(label).closest("li");
  if (!li) throw new Error(`no row for ${label} in ${region}`);
  return li;
}

/** Asserts exactly one action method fired, with exactly this id. */
function expectOnlyCall(fns: Record<string, Mock>, method: string, id: string) {
  expect(fns[method].mock.calls).toEqual([[id]]);
  for (const other of ACTION_METHODS) {
    if (other === method) continue;
    expect(fns[other]).not.toHaveBeenCalled();
  }
}

describe("TrashScreen — restore routes the clicked row to its own service call", () => {
  for (const c of CATEGORIES) {
    it(`${c.region}: Restore → ${c.restore}("${c.target.id}")`, async () => {
      const { fns } = await renderTrash();

      fireEvent.click(
        within(row(c.region, c.target.label)).getByRole("button", {
          name: "Restore",
        }),
      );

      await waitFor(() => expect(fns[c.restore]).toHaveBeenCalled());
      expectOnlyCall(fns, c.restore, c.target.id);
    });
  }
});

describe("TrashScreen — permanent delete routes through the confirm dialog", () => {
  for (const c of CATEGORIES) {
    it(`${c.region}: confirm → ${c.remove}("${c.target.id}")`, async () => {
      const { fns } = await renderTrash();

      fireEvent.click(
        within(row(c.region, c.target.label)).getByRole("button", {
          name: "Delete permanently",
        }),
      );
      const dialog = screen.getByRole("dialog");
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Delete permanently" }),
      );

      await waitFor(() => expect(fns[c.remove]).toHaveBeenCalled());
      expectOnlyCall(fns, c.remove, c.target.id);
    });
  }
});

describe("TrashScreen — the arguments the host derives before the call", () => {
  it("labels a daily by its date and an untitled todo by the fallback", async () => {
    await renderTrash();
    // Both come from the host's row mapping, and both are the label the
    // confirm dialog then quotes back — a wrong field silently deletes the
    // right id under the wrong name.
    within(screen.getByRole("region", { name: "Dailies" })).getByText(
      "2026-08-12",
    );
    within(screen.getByRole("region", { name: "Todos" })).getByText("Untitled");
  });

  it("names the pending row in the confirm message", async () => {
    await renderTrash();
    fireEvent.click(
      within(row("Todos", "Buy milk")).getByRole("button", {
        name: "Delete permanently",
      }),
    );
    // The host passes `{name}` through i18next as a literal so the view can
    // substitute the row label — double interpolation would leave "{name}".
    within(screen.getByRole("dialog")).getByText(
      '"Buy milk" will be permanently deleted. This cannot be undone.',
    );
  });

  it("cancelling the dialog calls nothing at all", async () => {
    const { fns } = await renderTrash();
    fireEvent.click(
      within(row("Todos", "Buy milk")).getByRole("button", {
        name: "Delete permanently",
      }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    for (const method of ACTION_METHODS) {
      expect(fns[method]).not.toHaveBeenCalled();
    }
  });

  it("pins the busy marker to the row that was clicked, not the category", async () => {
    const { fns } = await renderTrash();
    // Hold the write open so the in-flight frame is observable.
    let release!: () => void;
    fns.restoreTodo.mockImplementation(
      () => new Promise<void>((resolve) => (release = resolve)),
    );

    fireEvent.click(
      within(row("Todos", "Buy milk")).getByRole("button", { name: "Restore" }),
    );

    // The clicked row swaps its button for the status chip; its sibling in the
    // same category keeps the button (disabled) — that is the {category, id}
    // pair reaching TrashView, not just the category.
    await waitFor(() => screen.getByText("Restoring…"));
    within(row("Todos", "Buy milk")).getByText("Restoring…");
    const sibling = within(row("Todos", "Untitled")).getByRole("button", {
      name: "Restore",
    }) as HTMLButtonElement;
    expect(sibling.disabled).toBe(true);

    release();
    await waitFor(() => expect(screen.queryByText("Restoring…")).toBeNull());
  });
});

describe("TrashScreen — what the screen shows after the call returns", () => {
  it("re-fetches so the restored row leaves the list", async () => {
    const { fns } = await renderTrash();
    expect(fns.fetchDeletedTodos).toHaveBeenCalledTimes(1);

    fireEvent.click(
      within(row("Notes", "Design memo")).getByRole("button", {
        name: "Restore",
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Notes" })).toBeNull(),
    );
    // Every category is re-read, not just the one that changed.
    expect(fns.fetchDeletedTodos).toHaveBeenCalledTimes(2);
  });

  /*
   * #932 — a restore the DB refuses. The occurrence's (routine, date) pair was
   * re-taken by the generator while the row sat in the trash, so the row stays
   * where it is. It used to leave through an unhandled rejection: the reload
   * put the row back on screen and nothing anywhere said why the click did
   * nothing.
   */
  it("explains a refused restore without swapping the list for the error card", async () => {
    const harness = makeHarness();
    harness.fns.restoreScheduleItem.mockRejectedValueOnce(
      new ScheduleRestoreConflictError(["event-1"]),
    );
    renderInSync(harness);
    await screen.findByRole("region", { name: "Todos" });

    fireEvent.click(
      within(row("Events", "Dentist")).getByRole("button", {
        name: "Restore",
      }),
    );

    const notice = await screen.findByRole("status");
    expect(notice.textContent).toContain("already has this repeating event");
    // The list is still the list — a refusal is not a broken screen.
    expect(screen.queryByRole("button", { name: "Reload" })).toBeNull();
    within(screen.getByRole("region", { name: "Events" })).getByText("Dentist");
  });

  it("says something different when a restore simply broke", async () => {
    const harness = makeHarness();
    harness.fns.restoreNoteUnified.mockRejectedValueOnce(new Error("offline"));
    renderInSync(harness);
    await screen.findByRole("region", { name: "Todos" });

    fireEvent.click(
      within(row("Notes", "Design memo")).getByRole("button", {
        name: "Restore",
      }),
    );

    const notice = await screen.findByRole("status");
    expect(notice.textContent).toContain("Couldn't restore");
  });

  it("retries the whole fetch from the error card", async () => {
    const harness = makeHarness();
    harness.fns.fetchDeletedRoutines.mockRejectedValueOnce(
      new Error("offline"),
    );
    renderInSync(harness);

    const retry = await screen.findByRole("button", { name: "Reload" });
    fireEvent.click(retry);

    await screen.findByRole("region", { name: "Todos" });
    expect(screen.queryByRole("button", { name: "Reload" })).toBeNull();
    expect(harness.fns.fetchDeletedRoutines).toHaveBeenCalledTimes(2);
  });
});

/*
 * Bulk restore / delete (#1294), on the host side.
 *
 * shared/tests/trashView.test.tsx already pins WHICH refs a press hands over.
 * What only this side can see is what the host then does with them: the same
 * two category switches the single-row actions use, one row at a time, with a
 * failure counted rather than thrown. The last case is the one that matters
 * most — a bulk delete that dies halfway must leave the survivors listed and
 * SAY how many it could not take, because the alternative is a list that
 * silently disagrees with what the user just asked for.
 */
describe("TrashScreen — bulk actions (#1294)", () => {
  const tick = async (label: string) => {
    fireEvent.click(await screen.findByRole("checkbox", { name: label }));
  };

  it("routes a cross-category bulk restore to each category's own method", async () => {
    const { fns } = await renderTrash();

    await tick('Select "Buy milk"');
    await tick('Select "Design memo"');
    fireEvent.click(screen.getByRole("button", { name: "Restore selected" }));

    await waitFor(() => expect(fns.restoreNoteUnified).toHaveBeenCalled());
    expect(fns.restoreTodo.mock.calls).toEqual([["task-1"]]);
    expect(fns.restoreNoteUnified.mock.calls).toEqual([["note-1"]]);
    // Nothing that was not ticked moved.
    expect(fns.restoreRoutine).not.toHaveBeenCalled();
    expect(fns.permanentDeleteTodo).not.toHaveBeenCalled();
  });

  it("empties the trash across every category, once the confirm is answered", async () => {
    const { fns } = await renderTrash();

    fireEvent.click(screen.getByRole("button", { name: "Empty the trash" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete permanently",
      }),
    );

    await waitFor(() =>
      expect(fns.permanentDeleteScheduleItem).toHaveBeenCalled(),
    );
    // Two todos, one of each of the other four — the whole fixture.
    expect(fns.permanentDeleteTodo).toHaveBeenCalledTimes(2);
    expect(fns.permanentDeleteNoteUnified).toHaveBeenCalledTimes(1);
    expect(fns.permanentDeleteDailyUnified).toHaveBeenCalledTimes(1);
    expect(fns.permanentDeleteRoutine).toHaveBeenCalledTimes(1);
    expect(fns.restoreTodo).not.toHaveBeenCalled();
  });

  it("keeps going past a failure and says how many it could not handle", async () => {
    const harness = makeHarness();
    harness.fns.permanentDeleteTodo.mockRejectedValueOnce(new Error("offline"));
    renderInSync(harness);
    await screen.findByRole("region", { name: "Todos" });

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all Todos" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete permanently",
      }),
    );

    // The second row was still attempted after the first one threw.
    await waitFor(() =>
      expect(harness.fns.permanentDeleteTodo).toHaveBeenCalledTimes(2),
    );
    const notices = await screen.findAllByRole("status");
    expect(notices.some((n) => n.textContent?.includes("1"))).toBe(true);
    // …and the row that survived is still listed, not quietly gone.
    within(screen.getByRole("region", { name: "Todos" })).getByText("Buy milk");
  });
});
