import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AttachmentOrphanScan, DataService } from "@life-editor/shared";
import { AttachmentCleanupCard } from "../src/trash/AttachmentCleanupCard";

/*
 * #1438 — the host half of the sweep: dry run first, delete only what the dry
 * run listed, and never a delete the user did not confirm.
 *
 * `useTranslation` echoes its key (the labels are not what is under test), so
 * the assertions below read as key names.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const UID = "11111111-2222-3333-4444-555555555555";

function scanWith(paths: string[]): AttachmentOrphanScan {
  return {
    orphans: paths.map((path) => ({
      path,
      size: 1024,
      uploadedAt: "2026-01-01T00:00:00.000Z",
    })),
    scanned: paths.length,
    referenced: 0,
    recent: 0,
  };
}

function makeDS(overrides: Partial<DataService> = {}): DataService {
  return {
    findOrphanAttachments: vi.fn(async () => scanWith([])),
    deleteAttachment: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as DataService;
}

describe("AttachmentCleanupCard (#1438)", () => {
  it("shows nothing to delete until the dry run has run", async () => {
    const ds = makeDS({
      findOrphanAttachments: vi.fn(async () => scanWith([`${UID}/a.png`])),
    });
    render(<AttachmentCleanupCard dataService={ds} />);

    // No list, and above all no delete button, before the scan.
    expect(
      screen.queryByRole("button", { name: "attachmentCleanup.deleteAll" }),
    ).toBeNull();
    expect(ds.findOrphanAttachments).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "attachmentCleanup.scan" }),
    );

    expect(
      await screen.findByRole("list", { name: "attachmentCleanup.listLabel" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "attachmentCleanup.deleteAll" }),
    ).toBeTruthy();
  });

  it("says so, and offers no delete, when the sweep finds nothing", async () => {
    const ds = makeDS();
    render(<AttachmentCleanupCard dataService={ds} />);

    fireEvent.click(
      screen.getByRole("button", { name: "attachmentCleanup.scan" }),
    );

    expect(await screen.findByText("attachmentCleanup.nothing")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "attachmentCleanup.deleteAll" }),
    ).toBeNull();
  });

  it("deletes exactly what it listed, and only after the confirm", async () => {
    const first = scanWith([`${UID}/a.png`, `${UID}/b.png`]);
    const findOrphanAttachments = vi
      .fn<() => Promise<AttachmentOrphanScan>>()
      .mockResolvedValueOnce(first)
      .mockResolvedValue(scanWith([]));
    const deleteAttachment = vi.fn(async () => undefined);
    const ds = makeDS({ findOrphanAttachments, deleteAttachment });
    render(<AttachmentCleanupCard dataService={ds} />);

    fireEvent.click(
      screen.getByRole("button", { name: "attachmentCleanup.scan" }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "attachmentCleanup.deleteAll",
      }),
    );
    // The dialog is up and nothing has been removed yet.
    expect(deleteAttachment).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "attachmentCleanup.confirmLabel" }),
    );

    await waitFor(() => expect(deleteAttachment).toHaveBeenCalledTimes(2));
    expect(deleteAttachment).toHaveBeenCalledWith(`${UID}/a.png`);
    expect(deleteAttachment).toHaveBeenCalledWith(`${UID}/b.png`);
    // Re-read rather than filtered in place, so the panel shows the bucket.
    expect(findOrphanAttachments).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("attachmentCleanup.deleted")).toBeTruthy();
  });

  it("keeps going when one removal fails, and reports how many", async () => {
    const findOrphanAttachments = vi
      .fn<() => Promise<AttachmentOrphanScan>>()
      .mockResolvedValueOnce(scanWith([`${UID}/a.png`, `${UID}/b.png`]))
      .mockResolvedValue(scanWith([`${UID}/b.png`]));
    const deleteAttachment = vi
      .fn<(path: string) => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("nope"));
    const ds = makeDS({ findOrphanAttachments, deleteAttachment });
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<AttachmentCleanupCard dataService={ds} />);

    fireEvent.click(
      screen.getByRole("button", { name: "attachmentCleanup.scan" }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "attachmentCleanup.deleteAll",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "attachmentCleanup.confirmLabel" }),
    );

    expect(
      await screen.findByText("attachmentCleanup.partialFailure"),
    ).toBeTruthy();
    expect(deleteAttachment).toHaveBeenCalledTimes(2);
  });

  it("reports a failed dry run instead of an empty list", async () => {
    const ds = makeDS({
      findOrphanAttachments: vi.fn(async () => {
        throw new Error("storage down");
      }),
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<AttachmentCleanupCard dataService={ds} />);

    fireEvent.click(
      screen.getByRole("button", { name: "attachmentCleanup.scan" }),
    );

    expect(
      await screen.findByText("attachmentCleanup.scanFailed"),
    ).toBeTruthy();
    // An empty result would read as "nothing to clean up", which is a
    // different and much more reassuring statement than "I could not look".
    expect(screen.queryByText("attachmentCleanup.nothing")).toBeNull();
  });
});
