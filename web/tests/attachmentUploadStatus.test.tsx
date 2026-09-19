import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useState } from "react";
import {
  ToastProvider,
  ATTACHMENT_MAX_BYTES,
  type AttachmentRef,
  type DataService,
} from "@life-editor/shared";
import { useAttachmentUpload } from "../src/notes/useAttachmentUpload";
import { AttachmentUploadStatus } from "../src/notes/AttachmentUploadStatus";

/*
 * #1674 — the upload band above a note's body (D-20260902-materials-1 = B).
 *
 * The harness wires the hook to the band exactly the way NotesView does: the
 * host owns the file-name state, hands its setter to the hook, and draws the
 * band from it. NotesView itself needs the whole notes Provider tree, and the
 * seam worth pinning is this one — the band appears when the upload starts
 * and is gone however it ends.
 */

function livePicker(): HTMLInputElement | null {
  return document.body.querySelector<HTMLInputElement>('input[type="file"]');
}

function choose(name: string, size: number): void {
  const file = new File(["x"], name, { type: "image/png" });
  Object.defineProperty(file, "size", { value: size });
  const input = livePicker()!;
  Object.defineProperty(input, "files", { value: [file] });
  input.dispatchEvent(new Event("change"));
}

afterEach(() => {
  livePicker()?.remove();
});

function Harness({
  ds,
  onReady,
}: {
  ds: DataService;
  onReady: (attach: () => Promise<AttachmentRef | null>) => void;
}) {
  const [uploading, setUploading] = useState<string | null>(null);
  const wiring = useAttachmentUpload(ds, setUploading);
  onReady(() => wiring!.attach("image"));
  return (
    <AttachmentUploadStatus fileName={uploading} uploadingLabel="Uploading" />
  );
}

function mount(uploadAttachment: DataService["uploadAttachment"]) {
  let attach!: () => Promise<AttachmentRef | null>;
  const ds = {
    uploadAttachment,
    getAttachmentUrl: async () => "https://signed.example/x",
  } as unknown as DataService;
  render(
    <ToastProvider>
      <Harness ds={ds} onReady={(fn) => (attach = fn)} />
    </ToastProvider>,
  );
  return () => attach();
}

const REF: AttachmentRef = {
  path: "uid/a.png",
  name: "photo.png",
  mimeType: "image/png",
  size: 10,
};

describe("AttachmentUploadStatus (#1674)", () => {
  it("shows the band while the upload runs and removes it when it lands", async () => {
    let finish!: (ref: AttachmentRef) => void;
    const attach = mount(
      () => new Promise<AttachmentRef>((resolve) => (finish = resolve)),
    );

    expect(screen.queryByRole("status")).toBeNull();

    let pending!: Promise<AttachmentRef | null>;
    await act(async () => {
      pending = attach();
      choose("photo.png", 10);
    });

    const band = screen.getByRole("status");
    expect(band.textContent).toContain("photo.png");
    expect(band.textContent).toContain("Uploading");

    await act(async () => {
      finish(REF);
      await pending;
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("announces politely, without taking focus", async () => {
    const attach = mount(() => new Promise<AttachmentRef>(() => {}));
    await act(async () => {
      void attach();
      choose("photo.png", 10);
    });

    const band = screen.getByRole("status");
    expect(band.getAttribute("aria-live")).toBe("polite");
  });

  it("clears the band when the upload fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const attach = mount(async () => {
      throw new Error("network down");
    });

    await act(async () => {
      const pending = attach();
      choose("photo.png", 10);
      await pending;
    });

    expect(screen.queryByRole("status")).toBeNull();
    consoleError.mockRestore();
  });

  it("never shows the band for a file refused before upload", async () => {
    const upload = vi.fn();
    const seen: boolean[] = [];
    const attach = mount(upload as never);

    await act(async () => {
      const pending = attach();
      choose("huge.png", ATTACHMENT_MAX_BYTES + 1);
      seen.push(screen.queryByRole("status") !== null);
      await pending;
    });

    expect(upload).not.toHaveBeenCalled();
    expect(seen).toEqual([false]);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
