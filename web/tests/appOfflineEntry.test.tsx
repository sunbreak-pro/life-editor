import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import type { Session, SessionRead } from "@life-editor/shared";

/*
 * #2334 (plan P1c step 3) — the session gate with no network. getSession() can
 * hold its answer for about 50 seconds and then say null with a retryable error
 * (services/offlineSession.ts), which must not read as signed out.
 */

const h = vi.hoisted(() => ({
  read: null as ((r: SessionRead) => void) | null,
  reads: 0,
  entry: null as Session | null,
  entryArgs: [] as boolean[],
  listener: null as ((event: string, s: Session | null) => void) | null,
  unreachable: false,
  forget: vi.fn(),
}));

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({ t: (key: string) => key }),
  readSession: () => {
    h.reads += 1;
    return new Promise<SessionRead>((resolve) => {
      h.read = resolve;
    });
  },
  readOfflineEntry: async (requireData: boolean) => {
    h.entryArgs.push(requireData);
    return h.entry;
  },
  setSessionUnreachable: (next: boolean) => {
    h.unreachable = next;
  },
  isOffline: () => navigator.onLine === false,
  onAuthStateChange: (cb: (event: string, s: Session | null) => void) => {
    h.listener = cb;
    return { unsubscribe: () => {} };
  },
  hydrateDomainSnapshots: async () => {},
  forgetDomainSnapshots: async (userId: string) => h.forget(userId),
  requestPersistentStorage: async () => {},
  UnsavedGuardProvider: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("../src/MainScreen", () => ({
  MainScreen: ({ session }: { session: Session }) => (
    <div data-testid="main">{session.user.id}</div>
  ),
}));
vi.mock("../src/AuthScreen", () => ({
  AuthScreen: ({ recovery }: { recovery?: boolean }) => (
    <div data-testid={recovery ? "recovery" : "auth"} />
  ),
}));
vi.mock("../src/components/OfflineBanner", () => ({
  OfflineBanner: () => null,
}));
vi.mock("../src/components/AppUpdateBanner", () => ({
  AppUpdateBanner: () => null,
}));

const App = (await import("../src/App")).default;
const { SESSION_GATE_OFFLINE_MS, SESSION_GATE_ONLINE_MS } =
  await vi.importActual<typeof import("@life-editor/shared")>(
    "@life-editor/shared",
  );

const STORED = { user: { id: "u1" } } as unknown as Session;
const LIVE = { user: { id: "u1", email: "fresh" } } as unknown as Session;
const UNREACHABLE: SessionRead = { session: null, unreachable: true };
const NO_SESSION: SessionRead = { session: null, unreachable: false };
const MARK = "life-editor.pending-password-recovery";

const setOnline = (online: boolean) =>
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);

const flush = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const answer = (read: SessionRead) =>
  act(async () => {
    h.read?.(read);
    await vi.advanceTimersByTimeAsync(0);
  });

describe("App — opening with no network (#2334)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
    h.read = null;
    h.reads = 0;
    h.entry = null;
    h.entryArgs = [];
    h.listener = null;
    h.unreachable = false;
    h.forget.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.location.hash = "";
  });

  it("does not wait for a getSession that hangs: the stored session opens the app", async () => {
    setOnline(false);
    h.entry = STORED;
    render(<App />);
    await flush();
    expect(screen.getByText("Loading…")).toBeTruthy();

    await flush(SESSION_GATE_OFFLINE_MS);
    expect(screen.getByTestId("main").textContent).toBe("u1");
    expect(h.unreachable).toBe(true);
    expect(h.entryArgs).toEqual([true]);
  });

  it("opens the same way when getSession answers null with the network's error", async () => {
    setOnline(false);
    h.entry = STORED;
    render(<App />);
    await answer(UNREACHABLE);
    await flush();
    expect(screen.getByTestId("main")).toBeTruthy();
    expect(h.unreachable).toBe(true);
  });

  it("falls back on the sign-in screen with nothing stored", async () => {
    setOnline(false);
    render(<App />);
    await flush(SESSION_GATE_OFFLINE_MS);
    expect(screen.getByTestId("auth")).toBeTruthy();
    expect(h.unreachable).toBe(false);
  });

  it("gives a slow online start longer before it looks at storage", async () => {
    setOnline(true);
    h.entry = STORED;
    render(<App />);
    await flush(SESSION_GATE_OFFLINE_MS);
    expect(screen.getByText("Loading…")).toBeTruthy();
    await flush(SESSION_GATE_ONLINE_MS);
    expect(screen.getByTestId("main")).toBeTruthy();
  });

  it("does not look at storage after a clean no-session answer", async () => {
    setOnline(false);
    h.entry = STORED; // Would be wrong to use: getSession has said no session.
    render(<App />);
    await answer(NO_SESSION);
    await flush(SESSION_GATE_ONLINE_MS);
    expect(screen.getByTestId("auth")).toBeTruthy();
    expect(h.entryArgs).toEqual([]);
  });

  it("lets a later real answer take over from the stored session", async () => {
    setOnline(false);
    h.entry = STORED;
    render(<App />);
    await flush(SESSION_GATE_OFFLINE_MS);
    expect(h.unreachable).toBe(true);

    await answer({ session: LIVE, unreachable: false });
    expect(screen.getByTestId("main")).toBeTruthy();
    expect(h.unreachable).toBe(false);
  });

  it("is not signed out by INITIAL_SESSION null", async () => {
    setOnline(false);
    h.entry = STORED;
    render(<App />);
    await flush(SESSION_GATE_OFFLINE_MS);
    await act(async () => h.listener?.("INITIAL_SESSION", null));
    expect(screen.getByTestId("main")).toBeTruthy();
    expect(h.forget).not.toHaveBeenCalled();
  });

  it("asks again when the line comes back, and comes out of view-only", async () => {
    setOnline(false);
    h.entry = STORED;
    render(<App />);
    await answer(UNREACHABLE);
    await flush();
    expect(h.reads).toBe(1);

    setOnline(true);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(h.reads).toBe(2);
    await answer({ session: LIVE, unreachable: false });
    expect(h.unreachable).toBe(false);
  });

  it("keeps asking while the browser says online but the session cannot refresh", async () => {
    setOnline(true);
    h.entry = STORED;
    render(<App />);
    await answer(UNREACHABLE);
    await flush(30_000);
    expect(h.reads).toBe(2);
    expect(h.unreachable).toBe(true);
    await answer({ session: LIVE, unreachable: false });
    expect(h.unreachable).toBe(false);
  });

  it("comes out of view-only when supabase-js refreshes by itself", async () => {
    setOnline(false);
    h.entry = STORED;
    render(<App />);
    await flush(SESSION_GATE_OFFLINE_MS);
    await act(async () => h.listener?.("TOKEN_REFRESHED", LIVE));
    expect(h.unreachable).toBe(false);
    expect(screen.getByTestId("main")).toBeTruthy();
  });

  it("does not bring a session back after SIGNED_OUT", async () => {
    setOnline(false);
    h.entry = STORED;
    render(<App />);
    await flush(SESSION_GATE_OFFLINE_MS);
    await act(async () => h.listener?.("SIGNED_OUT", null));
    expect(screen.getByTestId("auth")).toBeTruthy();
    expect(h.unreachable).toBe(false);
    expect(h.forget).toHaveBeenCalledWith("u1");

    // getSession's answer from before the sign-out arrives now.
    await answer(UNREACHABLE);
    await flush(SESSION_GATE_ONLINE_MS);
    expect(screen.getByTestId("auth")).toBeTruthy();
    expect(screen.queryByTestId("main")).toBeNull();
  });

  it("does not let a look at storage from before the sign-out land after it", async () => {
    setOnline(false);
    h.entry = STORED;
    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(SESSION_GATE_OFFLINE_MS); // the look at storage starts
      h.listener?.("SIGNED_OUT", null);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByTestId("main")).toBeNull();
  });

  describe("password recovery stays as it was", () => {
    it("shows the reset card over the stored session, stored data or not", async () => {
      setOnline(false);
      window.sessionStorage.setItem(MARK, "1");
      h.entry = STORED;
      render(<App />);
      await flush(SESSION_GATE_OFFLINE_MS);
      expect(h.entryArgs).toEqual([false]);
      expect(screen.getByTestId("recovery")).toBeTruthy();
      expect(screen.queryByTestId("main")).toBeNull();
      expect(window.sessionStorage.getItem(MARK)).toBe("1");
    });

    it("drops a mark with no session behind it", async () => {
      setOnline(false);
      window.sessionStorage.setItem(MARK, "1");
      render(<App />);
      await flush(SESSION_GATE_OFFLINE_MS);
      expect(screen.getByTestId("auth")).toBeTruthy();
      expect(window.sessionStorage.getItem(MARK)).toBeNull();
    });

    it("leaves the URL for supabase-js until it has answered", async () => {
      setOnline(true);
      window.location.hash = "#type=recovery&access_token=t";
      render(<App />);
      await flush(SESSION_GATE_ONLINE_MS);
      expect(window.location.hash).not.toBe("");

      await answer({ session: LIVE, unreachable: false });
      expect(window.location.hash).toBe("");
    });

    it("still takes the recovery event after the gate's time limit", async () => {
      setOnline(true);
      render(<App />);
      await flush(SESSION_GATE_ONLINE_MS);
      expect(screen.getByTestId("auth")).toBeTruthy();
      await act(async () => h.listener?.("PASSWORD_RECOVERY", LIVE));
      expect(screen.getByTestId("recovery")).toBeTruthy();
    });
  });
});
