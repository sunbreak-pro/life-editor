import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import {
  ToastProvider,
  ATTACHMENT_MAX_BYTES,
  type DataService,
} from "@life-editor/shared";
import { pickFile } from "../src/notes/pickFile";
import { useAttachmentUpload } from "../src/notes/useAttachmentUpload";

/*
 * #1404 — the host half: the picker, and the checks between "user chose a
 * file" and "the document gets a node".
 *
 * `pickFile` builds its input on the fly (the slash menu runs inside a
 * ProseMirror plugin, not inside React, so there is no rendered input to
 * drive), which is exactly why it needs a test: nothing else in the tree would
 * notice if it stopped cleaning up after itself.
 */

/** The input `pickFile` just appended to the body. */
function livePicker(): HTMLInputElement | null {
  return document.body.querySelector<HTMLInputElement>('input[type="file"]');
}

function fakeFile(name: string, type: string, size: number): File {
  const file = new File(["x"], name, { type });
  // jsdom computes `size` from the parts; the tests need a specific one.
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function choose(input: HTMLInputElement, file: File): void {
  Object.defineProperty(input, "files", { value: [file] });
  input.dispatchEvent(new Event("change"));
}

afterEach(() => {
  livePicker()?.remove();
});

describe("pickFile (#1404)", () => {
  it("resolves the chosen file and takes its input back out of the DOM", async () => {
    const pending = pickFile("image/*");
    const input = livePicker();
    expect(input).not.toBeNull();
    expect(input?.accept).toBe("image/*");

    choose(input!, fakeFile("a.png", "image/png", 10));

    await expect(pending).resolves.toMatchObject({ name: "a.png" });
    // Left behind, the next open would inherit this one's selection.
    expect(livePicker()).toBeNull();
  });

  it("resolves null when the dialog is cancelled", async () => {
    const pending = pickFile();
    const input = livePicker();
    expect(input?.accept).toBe("");

    input?.dispatchEvent(new Event("cancel"));

    await expect(pending).resolves.toBeNull();
    expect(livePicker()).toBeNull();
  });
});

function wrapper({ children }: { children: ReactNode }) {
  return createElement(ToastProvider, null, children);
}

function makeDS(
  uploadAttachment: DataService["uploadAttachment"],
): DataService {
  return {
    uploadAttachment,
    getAttachmentUrl: async () => "https://signed.example/x",
  } as unknown as DataService;
}

describe("useAttachmentUpload (#1404)", () => {
  it("is undefined with no DataService, which is what hides the slash entries", () => {
    const { result } = renderHook(() => useAttachmentUpload(undefined), {
      wrapper,
    });
    // Offering a picker that uploads nowhere is worse than not offering one.
    expect(result.current).toBeUndefined();
  });

  it("uploads what the user chose", async () => {
    const upload = vi.fn(async () => ({
      path: "uid/abc.png",
      name: "a.png",
      mimeType: "image/png",
      size: 10,
    }));
    const { result } = renderHook(() => useAttachmentUpload(makeDS(upload)), {
      wrapper,
    });

    let ref: unknown;
    await act(async () => {
      const pending = result.current!.attach("image");
      choose(livePicker()!, fakeFile("a.png", "image/png", 10));
      ref = await pending;
    });

    expect(upload).toHaveBeenCalledTimes(1);
    expect(ref).toMatchObject({ path: "uid/abc.png" });
  });

  it("refuses an oversized file with a message that names the limit", async () => {
    const upload = vi.fn();
    const { result } = renderHook(
      () => useAttachmentUpload(makeDS(upload as never)),
      { wrapper },
    );

    let ref: unknown = "unset";
    await act(async () => {
      const pending = result.current!.attach("file");
      choose(
        livePicker()!,
        fakeFile(
          "huge.bin",
          "application/octet-stream",
          ATTACHMENT_MAX_BYTES + 1,
        ),
      );
      ref = await pending;
    });

    expect(ref).toBeNull();
    expect(upload).not.toHaveBeenCalled();
    // The service would also refuse this, but only with an English Error. The
    // point of the second check is that the user is TOLD, with the limit in it.
    expect(document.body.textContent).toContain("10.0 MB");
  });

  it("reports a failed upload instead of inserting a broken node", async () => {
    const upload = vi.fn(async () => {
      throw new Error("network down");
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { result } = renderHook(
      () => useAttachmentUpload(makeDS(upload as never)),
      { wrapper },
    );

    let ref: unknown = "unset";
    await act(async () => {
      const pending = result.current!.attach("image");
      choose(livePicker()!, fakeFile("a.png", "image/png", 10));
      ref = await pending;
    });

    expect(ref).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("resolves URLs straight through the DataService", async () => {
    const { result } = renderHook(
      () => useAttachmentUpload(makeDS(vi.fn() as never)),
      { wrapper },
    );
    await expect(result.current!.resolveUrl("uid/abc.png")).resolves.toBe(
      "https://signed.example/x",
    );
  });
});
