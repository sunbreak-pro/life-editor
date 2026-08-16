import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import type { Session } from "@life-editor/shared";

/*
 * #919 — the gate that keeps a half-finished recovery from becoming a normal
 * sign-in.
 *
 * A recovery link signs the user in before anyone gets to type a new
 * password, so the session gate alone would hand them the app. The event that
 * says "this one still owes us a password" fires exactly once, while
 * supabase-js consumes the URL — but the session it saved survives a reload,
 * which is why the mark has to survive with it. Reloading out of the reset
 * card was the way back into the app with the forgotten password still in
 * force, and nothing about it is visible in a passing build.
 */

const h = vi.hoisted(() => ({
  session: null as Session | null,
  listener: null as ((event: string, s: Session | null) => void) | null,
  unsubscribe: vi.fn(),
}));

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({ t: (key: string) => key }),
  getSession: () => Promise.resolve(h.session),
  onAuthStateChange: (cb: (event: string, s: Session | null) => void) => {
    h.listener = cb;
    return { unsubscribe: h.unsubscribe };
  },
  UnsavedGuardProvider: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("../src/MainScreen", () => ({
  MainScreen: () => <div data-testid="main" />,
}));
vi.mock("../src/AuthScreen", () => ({
  AuthScreen: ({
    recovery,
    onRecoveryComplete,
  }: {
    recovery?: boolean;
    onRecoveryComplete?: () => void;
  }) => (
    <div data-testid={recovery ? "recovery" : "credentials"}>
      <button onClick={() => onRecoveryComplete?.()}>done</button>
    </div>
  ),
}));
vi.mock("../src/components/OfflineBanner", () => ({
  OfflineBanner: () => null,
}));

const App = (await import("../src/App")).default;

const MARK = "life-editor.pending-password-recovery";
const SESSION = { user: { email: "me@example.com" } } as unknown as Session;

describe("App — password-recovery gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    h.session = null;
    h.listener = null;
  });

  afterEach(() => {
    window.location.hash = "";
  });

  it("holds the user on the reset card when the link signs them in", async () => {
    render(<App />);
    await screen.findByTestId("credentials");

    // What supabase-js does with a recovery link: the session lands first, the
    // event follows.
    act(() => h.listener?.("PASSWORD_RECOVERY", SESSION));

    expect(await screen.findByTestId("recovery")).toBeTruthy();
    expect(screen.queryByTestId("main")).toBeNull();
  });

  it("still holds them there after a reload", async () => {
    h.session = SESSION;
    window.sessionStorage.setItem(MARK, "1");

    // A fresh mount with the saved session and no event — a reload.
    render(<App />);

    expect(await screen.findByTestId("recovery")).toBeTruthy();
    expect(screen.queryByTestId("main")).toBeNull();
  });

  it("lets them into the app once the new password is set", async () => {
    h.session = SESSION;
    window.sessionStorage.setItem(MARK, "1");
    render(<App />);
    fireEvent.click(await screen.findByText("done"));

    expect(await screen.findByTestId("main")).toBeTruthy();
    expect(window.sessionStorage.getItem(MARK)).toBeNull();
  });

  it("drops a mark whose session is gone instead of stranding the sign-in", async () => {
    // Nothing to submit a password against, so the reset card would be a dead
    // end. The credentials card is the only useful screen here.
    window.sessionStorage.setItem(MARK, "1");
    render(<App />);

    expect(await screen.findByTestId("credentials")).toBeTruthy();
    await waitFor(() => expect(window.sessionStorage.getItem(MARK)).toBeNull());
  });

  it("clears the mark when the user signs out", async () => {
    h.session = SESSION;
    window.sessionStorage.setItem(MARK, "1");
    render(<App />);
    await screen.findByTestId("recovery");

    act(() => h.listener?.("SIGNED_OUT", null));

    expect(await screen.findByTestId("credentials")).toBeTruthy();
    expect(window.sessionStorage.getItem(MARK)).toBeNull();
  });

  it("takes the auth fragment out of the address bar", async () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    window.location.hash = "#error=access_denied&error_description=expired";

    render(<App />);
    await screen.findByTestId("credentials");

    expect(
      replaceState.mock.calls.some((c) => c[2] === window.location.pathname),
    ).toBe(true);
    expect(window.location.hash).toBe("");
    replaceState.mockRestore();
  });
});
