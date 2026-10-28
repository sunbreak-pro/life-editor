import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import { useSyncDomains } from "../src/hooks/useSyncDomains";
import {
  noteOwnWrite,
  resetOwnWriteLedger,
} from "../src/services/ownWriteLedger";

/*
 * #2290 item 3 — SyncProvider drops the Realtime echo of a write this client
 * recorded, and still refetches for everything else.
 *
 * Measured before the change: one note save was a 0.9KB RPC followed by a
 * 24KB refetch of the note list, triggered by the save's own echo. The
 * channel stub is the same two-method one as syncProviderRenderScope.
 */

type ChangeHandler = (payload: { new?: unknown; old?: unknown }) => void;

const handlers = new Map<string, ChangeHandler>();

interface ChannelStub {
  on: (
    event: string,
    filter: { table: string },
    cb: ChangeHandler,
  ) => ChannelStub;
  subscribe: () => ChannelStub;
}

const channel: ChannelStub = {
  on: (_event, filter, cb) => {
    handlers.set(filter.table, cb);
    return channel;
  },
  subscribe: () => channel,
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
const STAMP = "2026-10-21T03:00:00.123Z";

function NotesProbe({ onVersion }: { onVersion: (v: number) => void }) {
  onVersion(useSyncDomains("notes"));
  return null;
}

async function fire(table: string, row: unknown) {
  const handler = handlers.get(table);
  if (!handler) throw new Error(`no handler registered for ${table}`);
  await act(async () => {
    handler({ new: row, old: {} });
    await new Promise((r) => setTimeout(r, DEBOUNCE_MS + 20));
  });
}

async function mountProbe(): Promise<number[]> {
  const versions: number[] = [];
  render(
    <SyncProvider>
      <NotesProbe onVersion={(v) => versions.push(v)} />
    </SyncProvider>,
  );
  await waitFor(() => expect(handlers.size).toBeGreaterThan(0));
  return versions;
}

describe("SyncProvider and this client's own writes (#2290)", () => {
  beforeEach(() => {
    handlers.clear();
    resetOwnWriteLedger();
  });

  it("does not refetch for the echo of a recorded note save", async () => {
    const versions = await mountProbe();
    noteOwnWrite("items_meta", "note-1", STAMP);
    noteOwnWrite("notes_payload", "note-1");

    await fire("items_meta", { id: "note-1", role: "note", updated_at: STAMP });
    await fire("notes_payload", { item_id: "note-1" });

    expect(versions.at(-1)).toBe(0);
  });

  it("refetches for another device's save of the same note", async () => {
    const versions = await mountProbe();
    noteOwnWrite("items_meta", "note-1", STAMP);

    await fire("items_meta", {
      id: "note-1",
      role: "note",
      updated_at: "2026-10-21T03:00:05.000Z",
    });

    expect(versions.at(-1)).toBe(1);
  });

  it("refetches for a change nobody recorded", async () => {
    const versions = await mountProbe();
    await fire("notes_payload", { item_id: "note-2" });
    expect(versions.at(-1)).toBe(1);
  });
});
