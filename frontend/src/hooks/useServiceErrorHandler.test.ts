import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useServiceErrorHandler } from "./useServiceErrorHandler";

const showToast = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { error?: string }) =>
      opts?.error ? `${key}: ${opts.error}` : key,
  }),
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

describe("useServiceErrorHandler", () => {
  let originalDev: boolean | undefined;
  let errorSpy: Mock;

  beforeEach(() => {
    showToast.mockReset();
    originalDev = import.meta.env.DEV;
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {}) as Mock;
  });

  afterEach(() => {
    errorSpy.mockRestore();
    if (originalDev !== undefined) {
      (import.meta.env as Record<string, unknown>).DEV = originalDev;
    }
  });

  it("shows toast with translated message when handle is called", () => {
    const { result } = renderHook(() => useServiceErrorHandler());

    act(() => {
      result.current.handle(new Error("boom"), "errors.test.failed");
    });

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith("error", "errors.test.failed: boom");
  });

  it("deduplicates toasts for the same key within the rate limit window", () => {
    const { result } = renderHook(() => useServiceErrorHandler());

    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.handle(new Error(`err${i}`), "errors.test.failed");
      }
    });

    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it("shows toast again for the same key after the rate limit elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T00:00:00Z"));

    const { result } = renderHook(() => useServiceErrorHandler());

    act(() => {
      result.current.handle(new Error("first"), "errors.test.failed", {
        rateLimitMs: 1000,
      });
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    act(() => {
      result.current.handle(new Error("second"), "errors.test.failed", {
        rateLimitMs: 1000,
      });
    });

    expect(showToast).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("allows different keys independently", () => {
    const { result } = renderHook(() => useServiceErrorHandler());

    act(() => {
      result.current.handle(new Error("a"), "errors.one");
      result.current.handle(new Error("b"), "errors.two");
    });

    expect(showToast).toHaveBeenCalledTimes(2);
  });

  it("does not show toast when silent option is true", () => {
    const { result } = renderHook(() => useServiceErrorHandler());

    act(() => {
      result.current.handle(new Error("silent"), "errors.test.silent", {
        silent: true,
      });
    });

    expect(showToast).not.toHaveBeenCalled();
  });

  it("handles non-Error values", () => {
    const { result } = renderHook(() => useServiceErrorHandler());

    act(() => {
      result.current.handle("string error", "errors.test.string");
    });

    expect(showToast).toHaveBeenCalledWith(
      "error",
      "errors.test.string: string error",
    );
  });
});
