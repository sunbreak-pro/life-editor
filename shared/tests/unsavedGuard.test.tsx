import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRef, useState, type ReactNode } from "react";
import { RightSidebar, RightSidebarToggle } from "../src/components";
import { RightSidebarProvider, UnsavedGuardProvider } from "../src/context";
import {
  useUnsavedDraft,
  useUnsavedGuardOptional,
} from "../src/hooks/useUnsavedGuard";

/*
 * #753 — the containers ask before they tear content down.
 *
 * PR #745 gave every exit a PANEL can see its own question. What was left were
 * the exits it cannot: the right sidebar closing (the portal target goes null
 * and the panel's children unmount with it) and the section switching. From
 * inside the panel neither looks like anything at all, so the question moved
 * one level up — to a Provider that outlives the thing being asked about.
 *
 * jsdom has no layout, so nothing here reads a box: the panel's presence is
 * asserted through its accessible name and the question through its text.
 */

const LABELS = {
  title: "Details",
  close: "Close details",
  empty: "Nothing selected yet",
  resize: "Resize details panel",
};

const GUARD_LABELS = {
  message: "Discard your unsaved changes?",
  discard: "Discard",
  cancel: "Cancel",
};

/**
 * A panel with a draft in it. The checkbox stands in for typing: it flips the
 * ref the probe reads, exactly as a real host's `onDirtyChange` does.
 */
function DraftPanel({ startDirty = false }: { startDirty?: boolean }) {
  const dirtyRef = useRef(startDirty);
  const [, force] = useState(0);
  useUnsavedDraft(() => dirtyRef.current);
  return (
    <button
      type="button"
      onClick={() => {
        dirtyRef.current = !dirtyRef.current;
        force((n) => n + 1);
      }}
    >
      type something
    </button>
  );
}

function renderShell(children: ReactNode, guarded = true) {
  const tree = (
    <RightSidebarProvider>
      <RightSidebarToggle
        variant="panel"
        openLabel="Open details"
        closeLabel="Hide details"
      />
      <RightSidebar
        title={LABELS.title}
        closeLabel={LABELS.close}
        emptyLabel={LABELS.empty}
        resizeLabel={LABELS.resize}
      />
      {children}
    </RightSidebarProvider>
  );
  render(
    guarded ? (
      <UnsavedGuardProvider labels={GUARD_LABELS}>{tree}</UnsavedGuardProvider>
    ) : (
      tree
    ),
  );
  // Everything below is about CLOSING, so start from an open panel.
  fireEvent.click(screen.getByRole("button", { name: "Open details" }));
}

const panel = () => screen.queryByText(LABELS.empty);
const closeButton = () => screen.getByRole("button", { name: LABELS.close });
const question = () => screen.queryByText(GUARD_LABELS.message);

describe("UnsavedGuard — closing the right sidebar (#753)", () => {
  it("closes straight through when no content holds a draft", async () => {
    renderShell(<DraftPanel />);
    fireEvent.click(closeButton());

    await waitFor(() => expect(panel()).toBeNull());
    // Asking with nothing to discard is what teaches the user to dismiss the
    // dialog unread — and then the real question is useless too.
    expect(question()).toBeNull();
  });

  it("asks before the sidebar takes a draft down with it", async () => {
    renderShell(<DraftPanel startDirty />);
    fireEvent.click(closeButton());

    await screen.findByText(GUARD_LABELS.message);
    // A question, not a farewell: the panel is still open behind it.
    expect(panel()).not.toBeNull();
  });

  it("keeps the panel when the discard is refused, and asks again next time", async () => {
    renderShell(<DraftPanel startDirty />);
    fireEvent.click(closeButton());
    await screen.findByText(GUARD_LABELS.message);

    fireEvent.click(screen.getByRole("button", { name: GUARD_LABELS.cancel }));
    await waitFor(() => expect(question()).toBeNull());
    expect(panel()).not.toBeNull();

    // The second attempt MUST ask again. Nothing is cached up here — a flag
    // cleared on a refused close would throw the draft away in silence, having
    // just promised not to (#736's own trap, one level down).
    fireEvent.click(closeButton());
    await screen.findByText(GUARD_LABELS.message);
  });

  it("closes once the discard is agreed to", async () => {
    renderShell(<DraftPanel startDirty />);
    fireEvent.click(closeButton());
    await screen.findByText(GUARD_LABELS.message);

    fireEvent.click(screen.getByRole("button", { name: GUARD_LABELS.discard }));
    await waitFor(() => expect(panel()).toBeNull());
  });

  it("reads the draft LIVE, so a saved panel closes without a question", async () => {
    renderShell(<DraftPanel startDirty />);
    // The save landed: the host flips its ref back before anyone asks.
    fireEvent.click(screen.getByRole("button", { name: "type something" }));
    fireEvent.click(closeButton());

    await waitFor(() => expect(panel()).toBeNull());
    expect(question()).toBeNull();
  });

  it("guards the header toggle too, not just the panel's own X", async () => {
    renderShell(<DraftPanel startDirty />);
    fireEvent.click(screen.getByRole("button", { name: "Hide details" }));

    await screen.findByText(GUARD_LABELS.message);
    expect(panel()).not.toBeNull();
  });

  it("stops asking once the content holding the draft has unmounted", async () => {
    function Host() {
      const [mounted, setMounted] = useState(true);
      return (
        <>
          {mounted && <DraftPanel startDirty />}
          <button type="button" onClick={() => setMounted(false)}>
            drop the panel
          </button>
        </>
      );
    }
    renderShell(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "drop the panel" }));
    fireEvent.click(closeButton());

    // The probe deregisters on unmount, so the guard has nothing to protect.
    await waitFor(() => expect(panel()).toBeNull());
    expect(question()).toBeNull();
  });

  it("behaves exactly as before with no Provider mounted", async () => {
    renderShell(<DraftPanel startDirty />, false);
    fireEvent.click(closeButton());

    await waitFor(() => expect(panel()).toBeNull());
  });
});

describe("UnsavedGuard — confirmDiscard for other containers", () => {
  /*
   * The section switch is the other caller (web/src/hooks/useShellNavigation).
   * It does not exist in shared, so what is pinned here is the contract it
   * relies on: the promise settles false on a refusal and true on agreement,
   * and the probe is read at ASK time rather than at registration time.
   */
  /** A section body with a draft, plus the container's two presses. */
  function Section({ onAnswer }: { onAnswer: (ok: boolean) => void }) {
    const dirtyRef = useRef(true);
    useUnsavedDraft(() => dirtyRef.current);
    const guard = useUnsavedGuardOptional();
    return (
      <>
        <button
          type="button"
          onClick={() => void guard?.confirmDiscard().then(onAnswer)}
        >
          leave the section
        </button>
        <button
          type="button"
          onClick={() => {
            dirtyRef.current = false;
          }}
        >
          save
        </button>
      </>
    );
  }

  it("resolves false on a refusal and true once agreed", async () => {
    const answers: boolean[] = [];
    render(
      <UnsavedGuardProvider labels={GUARD_LABELS}>
        <Section onAnswer={(ok) => answers.push(ok)} />
      </UnsavedGuardProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "leave the section" }));
    await screen.findByText(GUARD_LABELS.message);
    fireEvent.click(screen.getByRole("button", { name: GUARD_LABELS.cancel }));
    await waitFor(() => expect(answers).toEqual([false]));

    fireEvent.click(screen.getByRole("button", { name: "leave the section" }));
    await screen.findByText(GUARD_LABELS.message);
    fireEvent.click(screen.getByRole("button", { name: GUARD_LABELS.discard }));
    await waitFor(() => expect(answers).toEqual([false, true]));

    // Saved: no question at all, and the move goes ahead.
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    fireEvent.click(screen.getByRole("button", { name: "leave the section" }));
    await waitFor(() => expect(answers).toEqual([false, true, true]));
    expect(question()).toBeNull();
  });
});
