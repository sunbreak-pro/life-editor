import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { IDBFactory } from "fake-indexeddb";
import {
  deletePersistentCache,
  writePersistedSnapshots,
} from "../src/state/persistentCache";
import { setSessionUnreachable } from "../src/state/connectivity";

/*
 * #2334 — what the session gate reads when the server cannot be reached. The
 * errors are the ones @supabase/auth-js 2.105.4 produces: its retryable failure
 * is an AuthRetryableFetchError, and `readSession` tells it apart by name.
 */

const KEY = "sb-test-auth-token";

const client = vi.hoisted(() => ({
  auth: { getSession: vi.fn(), signOut: vi.fn() },
}));
const forget = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("../src/services/supabaseClient", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSupabaseClient: () => client,
  authStorageKey: (url?: string) =>
    url === undefined
      ? KEY
      : `sb-${new URL(url).hostname.split(".")[0]}-auth-token`,
}));
vi.mock("../src/state/domainSnapshotStore", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  forgetDomainSnapshots: forget,
}));

const { readOfflineEntry, readSession, readStoredOwnerId, readStoredSession } =
  await import("../src/services/offlineSession");
const { signOut } = await import("../src/services/SupabaseAuth");
const { authStorageKey } = await vi.importActual<
  typeof import("../src/services/supabaseClient")
>("../src/services/supabaseClient");

const stored = (id: string) => ({
  access_token: "a",
  refresh_token: "r",
  expires_at: 1,
  user: { id },
});
const store = (id: string) =>
  localStorage.setItem(KEY, JSON.stringify(stored(id)));

class AuthRetryableFetchError extends Error {
  override name = "AuthRetryableFetchError";
}

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  // Closes the connections the store holds for these ids.
  await deletePersistentCache("u");
  await deletePersistentCache("someone-else");
  globalThis.indexedDB = new IDBFactory();
  setSessionUnreachable(false);
});

describe("authStorageKey", () => {
  it("names the key supabase-js would have used by itself", () => {
    const url = "https://abcdef.supabase.co";
    const own = createClient(url, "anon", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(authStorageKey(url)).toBe(own.auth["storageKey"]);
  });
});

describe("readSession", () => {
  it("passes a session through", async () => {
    const session = stored("u");
    client.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    expect(await readSession()).toEqual({ session, unreachable: false });
  });

  it("says a clean null is no session", async () => {
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    expect(await readSession()).toEqual({ session: null, unreachable: false });
  });

  it("says the network failed when the refresh could not reach it", async () => {
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: new AuthRetryableFetchError("Failed to fetch"),
    });
    expect(await readSession()).toEqual({ session: null, unreachable: true });
  });

  it("treats a refused refresh as no session: supabase-js has removed it", async () => {
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: new Error("Invalid Refresh Token"),
    });
    expect(await readSession()).toEqual({ session: null, unreachable: false });
  });

  it("does not reject when getSession throws", async () => {
    client.auth.getSession.mockRejectedValue(new Error("lock timed out"));
    expect(await readSession()).toEqual({ session: null, unreachable: true });
  });
});

describe("readStoredSession", () => {
  it("reads the stored session", async () => {
    store("u");
    expect((await readStoredSession())?.user.id).toBe("u");
    expect(await readStoredOwnerId()).toBe("u");
  });

  it("finds nothing once the session is gone, which is what a sign-out leaves", async () => {
    expect(await readStoredSession()).toBeNull();
    expect(await readStoredOwnerId()).toBeNull();
  });

  it.each([
    ["not JSON", "{oops"],
    ["null", "null"],
    ["no user", JSON.stringify({ access_token: "a", refresh_token: "r" })],
    ["no tokens", JSON.stringify({ user: { id: "u" } })],
  ])("refuses a stored value that is %s", async (_label, raw) => {
    localStorage.setItem(KEY, raw);
    expect(await readStoredSession()).toBeNull();
  });
});

describe("readOfflineEntry", () => {
  const list = { key: "todoTree", anchor: undefined, data: [] };

  it("opens with the stored session and lists stored for that user", async () => {
    store("u");
    await writePersistedSnapshots("u", [list]);
    expect((await readOfflineEntry(true))?.user.id).toBe("u");
  });

  it("refuses a stored session with nothing stored", async () => {
    store("u");
    expect(await readOfflineEntry(true)).toBeNull();
  });

  it("cannot reach another user's lists", async () => {
    store("u");
    await writePersistedSnapshots("someone-else", [list]);
    expect(await readOfflineEntry(true)).toBeNull();
  });

  it("refuses when no session is stored, whatever lists are", async () => {
    await writePersistedSnapshots("u", [list]);
    expect(await readOfflineEntry(true)).toBeNull();
    expect(await readOfflineEntry(false)).toBeNull();
  });

  it("needs no stored lists for the reset card", async () => {
    store("u");
    expect((await readOfflineEntry(false))?.user.id).toBe("u");
  });
});

describe("signOut with no connection", () => {
  it("makes no attempt and keeps the session's lists", async () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const { error } = await signOut();
    onLine.mockRestore();
    expect(error).not.toBeNull();
    expect(client.auth.signOut).not.toHaveBeenCalled();
    expect(forget).not.toHaveBeenCalled();
  });

  it("tries when only the session gate says unreachable, since the network may be back", async () => {
    setSessionUnreachable(true);
    client.auth.getSession.mockResolvedValue({
      data: { session: stored("u") },
      error: null,
    });
    client.auth.signOut.mockResolvedValue({ error: null });
    expect((await signOut()).error).toBeNull();
    expect(client.auth.signOut).toHaveBeenCalledTimes(1);
    expect(forget).toHaveBeenCalledWith("u");
  });

  it("keeps the lists when the server call fails", async () => {
    client.auth.getSession.mockResolvedValue({
      data: { session: stored("u") },
      error: null,
    });
    client.auth.signOut.mockResolvedValue({
      error: new Error("Failed to fetch"),
    });
    expect((await signOut()).error).toBe("Failed to fetch");
    expect(forget).not.toHaveBeenCalled();
  });

  it("forgets them after a real sign-out", async () => {
    client.auth.getSession.mockResolvedValue({
      data: { session: stored("u") },
      error: null,
    });
    client.auth.signOut.mockResolvedValue({ error: null });
    expect((await signOut()).error).toBeNull();
    expect(forget).toHaveBeenCalledWith("u");
  });
});
