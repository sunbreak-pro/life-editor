import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { useSyncDomains } from "../src/hooks/useSyncDomains";
import { SYNC_DOMAINS, type SyncDomain } from "../src/context/syncDomains";
import { requestOutboxSend } from "../src/state/outbox";

/*
 * #2335 — where the outbox plugs in: one wrapped DataService for the whole page,
 * and a send at each moment a gap may have ended.
 */

let status: ((s: string) => void) | null = null;
const channel = {
  on: () => channel,
  subscribe: (cb: (s: string) => void) => {
    status = cb;
    return channel;
  },
};

vi.mock("../src/services/supabaseClient", () => ({
  getSupabaseClient: () => ({
    auth: { getSession: async () => ({ data: { session: null } }) },
    realtime: { setAuth: () => {} },
    channel: () => channel,
    removeChannel: async () => {},
    from: () => ({}),
  }),
}));

const factory = await vi.importActual<
  typeof import("../src/services/dataServiceFactory")
>("../src/services/dataServiceFactory");

type OnSent = (domains: SyncDomain[]) => void;
const sendOutbox = vi.fn<(onSent: OnSent) => Promise<void>>();
vi.mock("../src/services/dataServiceFactory", () => ({
  sendOutbox: (onSent: OnSent) => sendOutbox(onSent),
}));

const { SyncProvider } = await import("../src/context/SyncContext");

describe("getDataService", () => {
  it("keeps one identity, and methods it does not wrap still route", () => {
    const ds = factory.getDataService();
    expect(factory.getDataService()).toBe(ds);
    expect(ds.fetchTimerSessions).toEqual(expect.any(Function));
    expect(ds.createTodoIfAbsent).toEqual(expect.any(Function));
  });
});

describe("SyncProvider sends the outbox", () => {
  const versions: Record<string, number[]> = {
    todos: [],
    notes: [],
    dailies: [],
    all: [],
  };
  function Probe() {
    versions.todos!.push(useSyncDomains("todos"));
    versions.notes!.push(useSyncDomains("notes"));
    versions.dailies!.push(useSyncDomains("dailies"));
    versions.all!.push(useSyncDomains(...SYNC_DOMAINS));
    return null;
  }

  beforeEach(async () => {
    sendOutbox.mockReset();
    sendOutbox.mockResolvedValue(undefined);
    versions.todos = [];
    versions.notes = [];
    versions.dailies = [];
    versions.all = [];
    status = null;
    render(
      <SyncProvider>
        <Probe />
      </SyncProvider>,
    );
    await waitFor(() => expect(status).not.toBeNull());
  });

  it("at app start", () => {
    expect(sendOutbox).toHaveBeenCalledTimes(1);
  });

  it("on online, on SUBSCRIBED after a gap and on return to the page", () => {
    window.dispatchEvent(new Event("online"));
    expect(sendOutbox).toHaveBeenCalledTimes(2);

    status?.("SUBSCRIBED");
    expect(sendOutbox).toHaveBeenCalledTimes(2);
    status?.("CLOSED");
    status?.("SUBSCRIBED");
    expect(sendOutbox).toHaveBeenCalledTimes(3);

    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(sendOutbox).toHaveBeenCalledTimes(4);
    hidden.mockRestore();
  });

  it("bumps only the domains the run changed", async () => {
    const onSent = sendOutbox.mock.calls[0]![0];
    await act(async () => {
      onSent(["todos"]);
      await new Promise((r) => setTimeout(r, 320));
    });
    expect(versions.todos!.at(-1)).toBe(1);
    expect(versions.notes!.at(-1)).toBe(0);
    expect(versions.dailies!.at(-1)).toBe(0);
    expect(versions.all!.at(-1)).toBe(1);

    // #2337: a note's send moves notes, which the Todo list does not read.
    await act(async () => {
      onSent(["notes"]);
      await new Promise((r) => setTimeout(r, 320));
    });
    expect(versions.todos!.at(-1)).toBe(1);
    expect(versions.notes!.at(-1)).toBe(1);
    expect(versions.all!.at(-1)).toBe(2);

    await act(async () => {
      onSent(["dailies"]);
      await new Promise((r) => setTimeout(r, 320));
    });
    expect(versions.todos!.at(-1)).toBe(1);
    expect(versions.notes!.at(-1)).toBe(1);
    expect(versions.dailies!.at(-1)).toBe(1);
    expect(versions.all!.at(-1)).toBe(3);
  });

  // #2337: the app-start send may have failed, and nothing else would fire.
  it("once, soon after saves are held online, however many there are", async () => {
    expect(sendOutbox).toHaveBeenCalledTimes(1);
    requestOutboxSend();
    requestOutboxSend();
    expect(sendOutbox).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(sendOutbox).toHaveBeenCalledTimes(2), {
      timeout: 1500,
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(sendOutbox).toHaveBeenCalledTimes(2);
  });
});
