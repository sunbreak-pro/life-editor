import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import { useSyncDomains } from "../src/hooks/useSyncDomains";
import { HIDDEN_RESUME_MS, createSyncResume } from "../src/context/syncResume";
import { SYNC_DOMAINS } from "../src/context/syncDomains";

/*
 * #2329 — re-read every domain when a gap in the Realtime connection ends.
 *
 * Changes made elsewhere while the socket was down never arrive as messages,
 * so the only way to pick them up is to re-read once the connection is back.
 * The provider half drives SyncProvider through a fake channel whose
 * `subscribe` callback the test calls by hand, the way realtime-js does on a
 * join and on every re-join.
 */

describe("createSyncResume", () => {
  it("does not resume on the first SUBSCRIBED (the initial join)", () => {
    const resume = vi.fn();
    const r = createSyncResume(resume);
    r.channelStatus("SUBSCRIBED");
    expect(resume).not.toHaveBeenCalled();
  });

  it.each(["CLOSED", "CHANNEL_ERROR", "TIMED_OUT"])(
    "resumes on SUBSCRIBED after %s",
    (drop) => {
      const resume = vi.fn();
      const r = createSyncResume(resume);
      r.channelStatus("SUBSCRIBED");
      r.channelStatus(drop);
      r.channelStatus("SUBSCRIBED");
      expect(resume).toHaveBeenCalledTimes(1);
    },
  );

  it("does not resume on a repeated SUBSCRIBED with no drop between", () => {
    const resume = vi.fn();
    const r = createSyncResume(resume);
    r.channelStatus("SUBSCRIBED");
    r.channelStatus("SUBSCRIBED");
    expect(resume).not.toHaveBeenCalled();
  });

  it("does not count a failed first join as a gap", () => {
    // The domains are still on their first read; a retry that then joins
    // has missed nothing that read will not return.
    const resume = vi.fn();
    const r = createSyncResume(resume);
    r.channelStatus("TIMED_OUT");
    r.channelStatus("SUBSCRIBED");
    expect(resume).not.toHaveBeenCalled();
  });

  it("resumes on online", () => {
    const resume = vi.fn();
    createSyncResume(resume).online();
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("resumes when the page comes back after a long time hidden", () => {
    let t = 0;
    const resume = vi.fn();
    const r = createSyncResume(resume, () => t);
    r.visibilityChange(true);
    t = HIDDEN_RESUME_MS;
    r.visibilityChange(false);
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("does not resume after a short time hidden, or when shown without hiding", () => {
    let t = 0;
    const resume = vi.fn();
    const r = createSyncResume(resume, () => t);
    r.visibilityChange(false);
    r.visibilityChange(true);
    t = HIDDEN_RESUME_MS - 1;
    r.visibilityChange(false);
    expect(resume).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// SyncProvider wiring
// ---------------------------------------------------------------------------

type StatusCallback = (status: string) => void;

let statusCallback: StatusCallback | null = null;

interface ChannelStub {
  on: () => ChannelStub;
  subscribe: (cb?: StatusCallback) => ChannelStub;
}

const channel: ChannelStub = {
  on: () => channel,
  subscribe: (cb) => {
    statusCallback = cb ?? null;
    return channel;
  },
};

vi.mock("../src/services/supabaseClient", () => ({
  getSupabaseClient: () => ({
    auth: { getSession: async () => ({ data: { session: null } }) },
    realtime: { setAuth: () => {} },
    channel: () => channel,
    removeChannel: async () => {},
  }),
}));

const { SyncProvider } = await import("../src/context/SyncContext");

const DEBOUNCE_MS = 300;

/** Sums every domain's counter, so one full re-read reads as +SYNC_DOMAINS.length. */
function AllProbe({ onVersion }: { onVersion: (v: number) => void }) {
  onVersion(useSyncDomains(...SYNC_DOMAINS));
  return null;
}

async function mountProbe(): Promise<number[]> {
  const versions: number[] = [];
  render(
    <SyncProvider>
      <AllProbe onVersion={(v) => versions.push(v)} />
    </SyncProvider>,
  );
  await waitFor(() => expect(statusCallback).not.toBeNull());
  return versions;
}

async function settle(fn: () => void) {
  await act(async () => {
    fn();
    await new Promise((r) => setTimeout(r, DEBOUNCE_MS + 20));
  });
}

describe("SyncProvider resumes after a gap (#2329)", () => {
  beforeEach(() => {
    statusCallback = null;
  });

  it("re-reads every domain once when the channel re-joins", async () => {
    const versions = await mountProbe();
    await settle(() => statusCallback?.("SUBSCRIBED"));
    expect(versions.at(-1)).toBe(0);

    await settle(() => {
      statusCallback?.("CLOSED");
      statusCallback?.("SUBSCRIBED");
    });
    expect(versions.at(-1)).toBe(SYNC_DOMAINS.length);
  });

  it("folds a re-join, online events and a return to the page into one re-read", async () => {
    const versions = await mountProbe();
    await settle(() => statusCallback?.("SUBSCRIBED"));

    const hidden = vi.spyOn(document, "hidden", "get");
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_000);
    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));

    await settle(() => {
      nowSpy.mockReturnValue(1_000 + HIDDEN_RESUME_MS);
      hidden.mockReturnValue(false);
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("online"));
      window.dispatchEvent(new Event("online"));
      window.dispatchEvent(new Event("online"));
      statusCallback?.("CHANNEL_ERROR");
      statusCallback?.("SUBSCRIBED");
    });
    hidden.mockRestore();
    nowSpy.mockRestore();

    expect(versions.at(-1)).toBe(SYNC_DOMAINS.length);
  });

  it("stops listening when it unmounts", async () => {
    const versions: number[] = [];
    const view = render(
      <SyncProvider>
        <AllProbe onVersion={(v) => versions.push(v)} />
      </SyncProvider>,
    );
    await waitFor(() => expect(statusCallback).not.toBeNull());
    view.unmount();
    const before = versions.length;
    await settle(() => window.dispatchEvent(new Event("online")));
    expect(versions.length).toBe(before);
  });
});
