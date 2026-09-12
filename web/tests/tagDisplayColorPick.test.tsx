import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Mock } from "vitest";
import {
  WikiTagsUnifiedProvider,
  type DataService,
  type WikiTagAssignmentUnified,
} from "@life-editor/shared";
import { stubDataService, createBumpableSync } from "./helpers";
import { TagColorControls } from "../src/wikitag/TagColorControls";

/*
 * #1580 — which of an item's tags lends it its colour on the calendar.
 *
 * The rule has two halves and only one of them is stored. The DEFAULT — the
 * tag that was put on first — is derived from the data (pickDisplayAssignment,
 * pinned in shared/tests/scheduleTagColor.test.ts); the OVERRIDE is a row in
 * `wiki_tag_assignments`. This file covers the seam between them, which is the
 * part a user actually operates:
 *
 *   - an item nobody has picked for still shows a checked radio, because the
 *     Schedule is already drawing it in that tag's colour. A control that
 *     showed nothing checked would be accurate about the stored value and
 *     wrong about the screen.
 *   - picking another one writes, and writes the TAG id — the hook resolves
 *     the assignment row itself, off the cache it is already rendering from.
 *
 * The real `useWikiTagsUnifiedAPI` is mounted (via its Provider) rather than
 * stubbed, because "which DataService call does this click make" is the
 * question, and a stubbed context would answer it by construction.
 *
 * No jest-dom in web/: presence comes from getBy* throwing, absence from
 * queryBy* being null.
 */

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts ? `${key}|${Object.values(opts).join(",")}` : key,
    }),
  };
});

const ITEM = "event-1";

const TAGS = [
  { id: "tag-work", name: "Work", color: "#1e3a8a", icon: null },
  { id: "tag-home", name: "Home", color: "#fde68a", icon: null },
];

/** Work was added first; Home a month later. Neither is an explicit pick. */
const ASSIGNMENTS: Partial<WikiTagAssignmentUnified>[] = [
  {
    id: "assign-home",
    tagId: "tag-home",
    itemId: ITEM,
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    isDisplayColor: false,
    isDeleted: false,
  },
  {
    id: "assign-work",
    tagId: "tag-work",
    itemId: ITEM,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    isDisplayColor: false,
    isDeleted: false,
  },
];

const { wrapper: SyncWrapper } = createBumpableSync();

function makeHarness(
  assignments: Partial<WikiTagAssignmentUnified>[] = ASSIGNMENTS,
) {
  const fns: Record<string, Mock> = {
    listAllWikiTagsUnified: vi.fn(async () => TAGS.map((t) => ({ ...t }))),
    listAllTagAssignments: vi.fn(async () =>
      assignments.map((a) => ({ ...a })),
    ),
    listAllTagConnections: vi.fn(async () => []),
    setDisplayColorTag: vi.fn(async () => undefined),
    updateWikiTagUnified: vi.fn(async () => ({ ...TAGS[0] })),
  };
  return { ds: stubDataService(fns) as DataService, fns };
}

async function renderControls(
  assignments?: Partial<WikiTagAssignmentUnified>[],
) {
  const h = makeHarness(assignments);
  render(
    <SyncWrapper>
      <WikiTagsUnifiedProvider dataService={h.ds}>
        <TagColorControls itemId={ITEM} />
      </WikiTagsUnifiedProvider>
    </SyncWrapper>,
  );
  await waitFor(() => {
    expect(screen.getAllByRole("radio").length).toBeGreaterThan(0);
  });
  return h;
}

/** The radio whose accessible name names `tagName`. */
const radioFor = (tagName: string) =>
  screen.getByLabelText(
    `itemActions.displayColorPick|${tagName}`,
  ) as HTMLInputElement;

describe("#1580 — picking which tag colours an item", () => {
  it("checks the earliest-added tag when nobody has picked", async () => {
    await renderControls();
    // Work was added in January, Home in February — and the list arrives
    // Home-first, so an implementation that took the first row would fail.
    expect(radioFor("Work").checked).toBe(true);
    expect(radioFor("Home").checked).toBe(false);
  });

  it("checks the explicit pick instead, when there is one", async () => {
    await renderControls(
      ASSIGNMENTS.map((a) =>
        a.id === "assign-home" ? { ...a, isDisplayColor: true } : a,
      ),
    );
    expect(radioFor("Home").checked).toBe(true);
    expect(radioFor("Work").checked).toBe(false);
  });

  it("writes the choice through the DataService, as the ITEM and its row", async () => {
    const { fns } = await renderControls();
    fireEvent.click(radioFor("Home"));
    await waitFor(() => {
      expect(fns.setDisplayColorTag).toHaveBeenCalledTimes(1);
    });
    // The hook resolves the tag id to its assignment row: the write is a swap
    // guarded by a partial UNIQUE on the item, so the service needs both.
    expect(fns.setDisplayColorTag).toHaveBeenCalledWith(ITEM, "assign-home");
  });

  it("moves the checked radio without waiting for a reload", async () => {
    await renderControls();
    fireEvent.click(radioFor("Home"));
    await waitFor(() => {
      expect(radioFor("Home").checked).toBe(true);
    });
    // The old mark has to come off in the same pass. Flipping only the new row
    // would leave two lit until the next refresh — and the DB, where the swap
    // did happen, would disagree with the screen.
    expect(radioFor("Work").checked).toBe(false);
  });

  it("does not touch the tag's own colour when the radio moves", async () => {
    // The colour belongs to the TAG; this control only says which tag speaks.
    const { fns } = await renderControls();
    fireEvent.click(radioFor("Home"));
    await waitFor(() => {
      expect(fns.setDisplayColorTag).toHaveBeenCalled();
    });
    expect(fns.updateWikiTagUnified).not.toHaveBeenCalled();
  });

  it("says what the default is, so a checked radio is not a mystery", async () => {
    await renderControls();
    expect(
      screen.getByText("itemActions.displayColorDefaultHint"),
    ).toBeTruthy();
  });
});
