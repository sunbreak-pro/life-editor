import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import { useSyncDomains } from "../src/hooks/useSyncDomains";

/*
 * #676 (d) — a domain change must not RE-RENDER the consumers of other domains.
 *
 * #499 already scoped the NUMBER each consumer reads: `useSyncDomains("timer")`
 * only moves when a timer table changed. What it could not scope was the
 * re-render. The counters lived in Provider state, so every bump made a new
 * context value, `useContext` woke every consumer, and only then did each one
 * compute that its own total was unchanged. On a note edit that meant
 * TimerProvider, AudioProvider, CalendarProvider and every domain hook all
 * re-rendered to conclude nothing had happened — the exact cost the domain
 * split was introduced to remove.
 *
 * The counters are an external store now and the context value has a stable
 * identity, so the bail-out happens before the render. That is invisible to
 * every other test in the suite (behaviour is identical either way), which is
 * why it gets one of its own: counting renders is the only way to see it, and
 * a regression here is silent — slower, never wrong.
 *
 * The Realtime channel is stubbed down to the two things the Provider uses: it
 * registers one postgres_changes handler per table and subscribes. Firing a
 * captured handler is what a row change looks like from inside.
 */

type ChangeHandler = (payload: { new?: unknown; old?: unknown }) => void;

const handlers = new Map<string, ChangeHandler>();

/** The two channel methods SyncProvider uses, both chainable. */
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

/** Debounce inside SyncProvider before a burst turns into one bump. */
const DEBOUNCE_MS = 300;

function DomainProbe({
  domain,
  onRender,
}: {
  domain: "timer" | "notes";
  onRender: (version: number) => void;
}) {
  const version = useSyncDomains(domain);
  onRender(version);
  return null;
}

/** Fire a row change on `table` and let the Provider's debounce elapse. */
async function changeRow(table: string) {
  const fire = handlers.get(table);
  if (!fire) throw new Error(`no handler registered for ${table}`);
  await act(async () => {
    fire({ new: {}, old: {} });
    await new Promise((r) => setTimeout(r, DEBOUNCE_MS + 20));
  });
}

describe("SyncProvider only re-renders the domains that moved", () => {
  beforeEach(() => {
    handlers.clear();
  });

  it("leaves a timer consumer untouched when a note changes", async () => {
    const timerRenders: number[] = [];
    const notesRenders: number[] = [];

    render(
      <SyncProvider>
        <DomainProbe domain="timer" onRender={(v) => timerRenders.push(v)} />
        <DomainProbe domain="notes" onRender={(v) => notesRenders.push(v)} />
      </SyncProvider>,
    );
    // The channel is built inside an async effect (it awaits getSession).
    await waitFor(() => expect(handlers.size).toBeGreaterThan(0));

    const timerBefore = timerRenders.length;
    const notesBefore = notesRenders.length;

    await changeRow("notes_payload");

    // The notes probe saw a new number; the timer probe did not run at all.
    expect(notesRenders.length).toBeGreaterThan(notesBefore);
    expect(notesRenders.at(-1)).toBe(1);
    expect(timerRenders.length).toBe(timerBefore);
  });

  it("still wakes a timer consumer when a timer table changes", async () => {
    const timerRenders: number[] = [];

    render(
      <SyncProvider>
        <DomainProbe domain="timer" onRender={(v) => timerRenders.push(v)} />
      </SyncProvider>,
    );
    await waitFor(() => expect(handlers.size).toBeGreaterThan(0));

    await changeRow("timer_settings");

    // Under-declaring is the dangerous direction (#499): the counter MUST move
    // for the domain the consumer asked for, or the data goes silently stale.
    expect(timerRenders.at(-1)).toBe(1);
  });
});
