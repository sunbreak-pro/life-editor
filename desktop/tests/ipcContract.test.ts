import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DESKTOP_IPC,
  DESKTOP_IPC_CHANNELS,
  type DesktopAuthStorageApi,
} from "../src/shared/ipcContract";
import type { DesktopAuthStorageBridge } from "../../shared/src/services/supabaseAuthStorage";

/*
 * #894 — desktop's first tests.
 *
 * The package had none, and its CI gate is `tsc --noEmit` + a build (#529).
 * Neither catches the thing that actually breaks here: two string literals in
 * two files that have to agree. Rename `authStorage:getItem` in the preload
 * and not in main and everything compiles, everything builds, and the
 * packaged app quietly stops persisting the login — the #838 symptom.
 */

// -- 1. Signature lockstep with shared/ -------------------------------------
//
// `shared/src/services/supabaseAuthStorage.ts` re-declares the bridge shape
// because it must not import electron, so nothing links the two declarations.
// These two assignments do: assignability in BOTH directions means neither
// side can add a method, drop one, or change an argument or return type
// without failing desktop's typecheck. They are compile-time only — the
// `it()` below exists so a reader sees them run.

const contractSatisfiesBridge: DesktopAuthStorageBridge =
  {} as DesktopAuthStorageApi;
const bridgeSatisfiesContract: DesktopAuthStorageApi =
  {} as DesktopAuthStorageBridge;

describe("authStorage bridge (#894)", () => {
  it("has the same shape on both sides of the boundary", () => {
    // The real check happened at compile time; this keeps the bindings alive
    // and gives the failure a name in the report if the types ever diverge.
    expect(contractSatisfiesBridge).toBeDefined();
    expect(bridgeSatisfiesContract).toBeDefined();
  });

  it("routes its three methods to three distinct channels", () => {
    const channels = [
      DESKTOP_IPC.authStorageGetItem,
      DESKTOP_IPC.authStorageSetItem,
      DESKTOP_IPC.authStorageRemoveItem,
    ];
    expect(new Set(channels).size).toBe(3);
  });
});

// -- 2. Both ends cover exactly the contract --------------------------------

const invoke = vi.fn();
const handle = vi.fn();
const exposeInMainWorld = vi.fn();

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: (key: string, api: unknown) =>
      exposeInMainWorld(key, api),
  },
  ipcRenderer: { invoke: (...args: unknown[]) => invoke(...args) },
  ipcMain: { handle: (...args: unknown[]) => handle(...args) },
}));

beforeEach(() => {
  invoke.mockReset();
  handle.mockReset();
  exposeInMainWorld.mockReset();
  invoke.mockResolvedValue(undefined);
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("preload (#894)", () => {
  it("exposes one bridge object under `desktop`", async () => {
    await import("../src/preload/index");
    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    expect(exposeInMainWorld.mock.calls[0][0]).toBe("desktop");
  });

  it("invokes only channels the contract declares", async () => {
    await import("../src/preload/index");
    const api = exposeInMainWorld.mock.calls[0][1] as {
      getTheme: () => Promise<unknown>;
      setTheme: (t: string) => Promise<unknown>;
      getWindowBounds: () => Promise<unknown>;
      getAppVersion: () => Promise<unknown>;
      authStorage: {
        getItem: (k: string) => Promise<unknown>;
        setItem: (k: string, v: string) => Promise<unknown>;
        removeItem: (k: string) => Promise<unknown>;
      };
    };

    await api.getTheme();
    await api.setTheme("dark");
    await api.getWindowBounds();
    await api.getAppVersion();
    await api.authStorage.getItem("k");
    await api.authStorage.setItem("k", "v");
    await api.authStorage.removeItem("k");

    const used = invoke.mock.calls.map((call) => call[0] as string);
    // Every declared channel is reachable from the renderer, and nothing else
    // is — an invoke of an undeclared name has no handler in main.
    expect([...used].sort()).toEqual([...DESKTOP_IPC_CHANNELS].sort());
  });

  it("forwards the arguments each channel expects", async () => {
    await import("../src/preload/index");
    const api = exposeInMainWorld.mock.calls[0][1] as {
      setTheme: (t: string) => Promise<unknown>;
      authStorage: { setItem: (k: string, v: string) => Promise<unknown> };
    };

    await api.setTheme("light");
    await api.authStorage.setItem("session", "payload");

    expect(invoke).toHaveBeenCalledWith(DESKTOP_IPC.setTheme, "light");
    expect(invoke).toHaveBeenCalledWith(
      DESKTOP_IPC.authStorageSetItem,
      "session",
      "payload",
    );
  });
});

describe("channel table (#894)", () => {
  it("lists every channel exactly once", () => {
    expect(new Set(DESKTOP_IPC_CHANNELS).size).toBe(
      DESKTOP_IPC_CHANNELS.length,
    );
    expect(DESKTOP_IPC_CHANNELS.length).toBe(Object.keys(DESKTOP_IPC).length);
  });

  it("namespaces every channel, so a bare name cannot collide", () => {
    for (const channel of DESKTOP_IPC_CHANNELS) {
      expect(channel).toMatch(/^[a-zA-Z]+:[a-zA-Z]+$/);
    }
  });
});
