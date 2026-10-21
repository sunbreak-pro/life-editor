import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import type { Session } from "@life-editor/shared";

/*
 * #2331 — the root waits for the lists stored on this device before it draws
 * MainScreen, and forgets them when the user signs out.
 *
 * Every domain reads its first frame from the snapshot store synchronously,
 * so MainScreen mounting before the load finishes would draw skeletons
 * exactly as before the device copy existed.
 */

const h = vi.hoisted(() => ({
  session: null as Session | null,
  listener: null as ((event: string, s: Session | null) => void) | null,
  release: null as (() => void) | null,
  hydrate: vi.fn(),
  forget: vi.fn(),
}));

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({ t: (key: string) => key }),
  getSession: () => Promise.resolve(h.session),
  onAuthStateChange: (cb: (event: string, s: Session | null) => void) => {
    h.listener = cb;
    return { unsubscribe: () => {} };
  },
  hydrateDomainSnapshots: (userId: string) => {
    h.hydrate(userId);
    return new Promise<void>((resolve) => {
      h.release = resolve;
    });
  },
  forgetDomainSnapshots: async (userId: string) => {
    h.forget(userId);
  },
  UnsavedGuardProvider: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("../src/MainScreen", () => ({
  MainScreen: () => <div data-testid="main" />,
}));
vi.mock("../src/AuthScreen", () => ({
  AuthScreen: () => <div data-testid="auth" />,
}));
vi.mock("../src/components/OfflineBanner", () => ({
  OfflineBanner: () => null,
}));

const App = (await import("../src/App")).default;

const SESSION = {
  user: { id: "user-1", email: "me@example.com" },
} as unknown as Session;

describe("App — device snapshots (#2331)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    h.session = null;
    h.listener = null;
    h.release = null;
  });

  it("holds MainScreen back until the user's stored lists are loaded", async () => {
    h.session = SESSION;
    render(<App />);
    await act(async () => {});

    expect(h.hydrate).toHaveBeenCalledWith("user-1");
    expect(screen.queryByTestId("main")).toBeNull();
    expect(screen.getByText("Loading…")).toBeTruthy();

    await act(async () => h.release?.());
    expect(screen.getByTestId("main")).toBeTruthy();
  });

  it("forgets the user's lists on SIGNED_OUT", async () => {
    h.session = SESSION;
    render(<App />);
    await act(async () => {});
    await act(async () => h.release?.());
    expect(screen.getByTestId("main")).toBeTruthy();

    await act(async () => h.listener?.("SIGNED_OUT", null));
    expect(h.forget).toHaveBeenCalledWith("user-1");
    expect(screen.getByTestId("auth")).toBeTruthy();
  });

  it("does not load anything while signed out", async () => {
    render(<App />);
    await act(async () => {});
    expect(h.hydrate).not.toHaveBeenCalled();
    expect(screen.getByTestId("auth")).toBeTruthy();
  });
});
