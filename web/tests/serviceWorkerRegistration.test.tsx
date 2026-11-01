import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

/*
 * #2334 (plan P1c step 2) — the worker registers on the public web only, and a
 * new version waits for the user's press. The module keeps one waiting worker
 * for the page, so each test starts from a fresh import.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

interface FakeWorker extends EventTarget {
  state: string;
  postMessage: ReturnType<typeof vi.fn>;
}
const worker = (state: string): FakeWorker =>
  Object.assign(new EventTarget(), { state, postMessage: vi.fn() });

const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

let container: EventTarget & {
  controller: unknown;
  register: ReturnType<typeof vi.fn>;
};
let registration: EventTarget & {
  waiting: FakeWorker | null;
  installing: FakeWorker | null;
  update: ReturnType<typeof vi.fn>;
};
const reload = vi.fn();

async function load() {
  vi.resetModules();
  const sw = await import("../src/pwa/serviceWorker");
  const { AppUpdateBanner } = await import("../src/components/AppUpdateBanner");
  return { ...sw, AppUpdateBanner };
}

beforeEach(() => {
  registration = Object.assign(new EventTarget(), {
    waiting: null,
    installing: null,
    update: vi.fn().mockResolvedValue(undefined),
  });
  container = Object.assign(new EventTarget(), {
    controller: {},
    register: vi.fn().mockResolvedValue(registration),
  });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: container,
  });
  vi.stubGlobal("location", {
    ...window.location,
    protocol: "https:",
    reload,
  });
  reload.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "serviceWorker");
  Reflect.deleteProperty(window, "Capacitor");
  Reflect.deleteProperty(window, "desktop");
});

describe("where the worker registers", () => {
  it("registers /sw.js on the public web", async () => {
    const { registerAppServiceWorker } = await load();
    registerAppServiceWorker(true);
    expect(container.register).toHaveBeenCalledWith("/sw.js");
  });

  it("does not register on a dev server", async () => {
    const { registerAppServiceWorker } = await load();
    registerAppServiceWorker(false);
    expect(container.register).not.toHaveBeenCalled();
  });

  it("does not register in the iOS shell", async () => {
    Object.assign(window, { Capacitor: { isNativePlatform: () => true } });
    const { registerAppServiceWorker } = await load();
    registerAppServiceWorker(true);
    expect(container.register).not.toHaveBeenCalled();
  });

  it("does not register in Desktop", async () => {
    Object.assign(window, { desktop: {} });
    const { registerAppServiceWorker } = await load();
    registerAppServiceWorker(true);
    expect(container.register).not.toHaveBeenCalled();
  });

  it("does not register from file:// or capacitor://", async () => {
    vi.stubGlobal("location", { ...window.location, protocol: "file:" });
    const { shouldRegisterServiceWorker } = await load();
    expect(shouldRegisterServiceWorker(true)).toBe(false);
  });

  it("does nothing where the browser has no Service Worker", async () => {
    Reflect.deleteProperty(navigator, "serviceWorker");
    const { shouldRegisterServiceWorker } = await load();
    expect(shouldRegisterServiceWorker(true)).toBe(false);
  });
});

describe("a new version", () => {
  async function mounted() {
    const { registerAppServiceWorker, AppUpdateBanner } = await load();
    registerAppServiceWorker(true);
    render(<AppUpdateBanner />);
    await flush();
  }

  it("offers nothing when there is no new version", async () => {
    await mounted();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("offers nothing on the first install, which replaces nothing", async () => {
    container.controller = null;
    registration.waiting = worker("installed");
    await mounted();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("offers a version that was already waiting", async () => {
    registration.waiting = worker("installed");
    await mounted();
    expect(screen.getByRole("status").textContent).toContain(
      "appUpdate.message",
    );
    expect(reload).not.toHaveBeenCalled();
  });

  it("offers a version found while the page is open, without reloading", async () => {
    await mounted();
    const installing = worker("installing");
    registration.installing = installing;
    registration.dispatchEvent(new Event("updatefound"));
    registration.installing = null;
    registration.waiting = installing;
    installing.state = "installed";
    act(() => {
      installing.dispatchEvent(new Event("statechange"));
    });
    expect(screen.getByRole("status")).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();
  });

  it("applies only on the press, and reloads once it has taken over", async () => {
    const waiting = worker("installed");
    registration.waiting = waiting;
    await mounted();
    expect(waiting.postMessage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "appUpdate.reload" }));
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(reload).not.toHaveBeenCalled();

    container.dispatchEvent(new Event("controllerchange"));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("offers a version that was installing before the page started listening", async () => {
    const installing = worker("installing");
    registration.installing = installing;
    await mounted();
    expect(screen.queryByRole("status")).toBeNull();

    registration.installing = null;
    registration.waiting = installing;
    installing.state = "installed";
    act(() => {
      installing.dispatchEvent(new Event("statechange"));
    });
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("takes the band down when the waiting version goes away", async () => {
    const waiting = worker("installed");
    registration.waiting = waiting;
    await mounted();
    expect(screen.getByRole("status")).toBeTruthy();

    waiting.state = "redundant";
    act(() => {
      waiting.dispatchEvent(new Event("statechange"));
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  describe("when another tab applies the version", () => {
    it("does not reload by itself, and keeps a band that works", async () => {
      const waiting = worker("installed");
      registration.waiting = waiting;
      await mounted();

      waiting.state = "activated";
      registration.waiting = null;
      act(() => {
        container.dispatchEvent(new Event("controllerchange"));
      });
      expect(reload).not.toHaveBeenCalled();

      // No second controllerchange is coming, so the press has to reload itself.
      fireEvent.click(screen.getByRole("button", { name: "appUpdate.reload" }));
      expect(reload).toHaveBeenCalledTimes(1);
      expect(waiting.postMessage).not.toHaveBeenCalled();
    });

    it("offers the reload to a page that had not seen the new version", async () => {
      await mounted();
      expect(screen.queryByRole("status")).toBeNull();

      act(() => {
        container.dispatchEvent(new Event("controllerchange"));
      });
      expect(reload).not.toHaveBeenCalled();
      expect(screen.getByRole("status").textContent).toContain(
        "appUpdate.message",
      );
    });
  });
});
