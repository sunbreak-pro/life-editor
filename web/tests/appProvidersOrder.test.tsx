import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DataService } from "@life-editor/shared";

/*
 * The global Provider chain's ORDER (#676 (a)).
 *
 * Order here is a dependency graph, not a style choice, and it has been wrong
 * before: Audio used to sit inside Timer, which forced the `chimeRef` +
 * AudioChimeBridge back-channel that #676 (c) deleted. An inversion like that
 * is quiet — most of the app keeps working and only one feature goes dead — so
 * the nesting is worth pinning down now that it lives in one file.
 *
 * Every Provider is replaced by a marker div. The real ones are useless here
 * (Sync opens a Supabase Realtime channel, Audio builds HTMLAudioElements
 * against Storage URLs) and none of them says anything about which wraps
 * which, so the test asserts the one thing this module actually decides: the
 * ancestor chain a child sees.
 */

const h = vi.hoisted(() => ({
  /** Flips the #320 native-mobile gate. */
  nativeMobile: false,
  marker:
    (name: string) =>
    ({ children }: { children?: React.ReactNode }) => (
      <div data-provider={name}>{children}</div>
    ),
}));

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isNativeMobile: () => h.nativeMobile,
  ToastProvider: h.marker("Toast"),
  SyncProvider: h.marker("Sync"),
  ShortcutConfigProvider: h.marker("ShortcutConfig"),
  AudioProvider: h.marker("Audio"),
  RightSidebarProvider: h.marker("RightSidebar"),
}));
vi.mock("../src/UndoRedoHost", () => ({ UndoRedoHost: h.marker("UndoRedo") }));
vi.mock("../src/TimerHost", () => ({ TimerHost: h.marker("Timer") }));
vi.mock("../src/GlobalShortcuts", () => ({
  GlobalShortcuts: () => <div data-testid="shortcuts" />,
}));
vi.mock("../src/MaterialsCountsBridge", () => ({
  MaterialsCountsBridge: () => <div data-testid="counts" />,
}));

const { AppProviders } = await import("../src/AppProviders");

const ds = {} as DataService;

function renderChain() {
  render(
    <AppProviders
      dataService={ds}
      onMaterialsCounts={vi.fn()}
      shortcuts={{
        onNavigate: vi.fn(),
        onOpenSettings: vi.fn(),
        onTogglePalette: vi.fn(),
        onNewTodo: vi.fn(),
      }}
    >
      <span data-testid="leaf" />
    </AppProviders>,
  );
}

/** Providers wrapping `el`, outermost first. */
function providersAround(el: HTMLElement): string[] {
  const names: string[] = [];
  for (let node = el.parentElement; node; node = node.parentElement) {
    const name = node.dataset.provider;
    if (name) names.unshift(name);
  }
  return names;
}

beforeEach(() => {
  h.nativeMobile = false;
});

describe("AppProviders", () => {
  it("nests the global chain outer→inner in dependency order", () => {
    renderChain();

    // Audio OUTSIDE Timer is the load-bearing pair: the Timer's
    // onSessionComplete rings a chime that Audio owns, so a swap here brings
    // the ref back-channel with it. RightSidebar innermost is what lets the
    // shell and its palette/tag-editor siblings all portal into the panel.
    expect(providersAround(screen.getByTestId("leaf"))).toEqual([
      "Toast",
      "Sync",
      "UndoRedo",
      "ShortcutConfig",
      "Audio",
      "Timer",
      "RightSidebar",
    ]);
  });

  it("keeps each headless bridge inside the Provider it reads", () => {
    renderChain();

    // The counts bridge refetches on Realtime bumps (needs Sync); the shortcut
    // executor reads the live rebindable config (needs ShortcutConfig).
    expect(providersAround(screen.getByTestId("counts"))).toContain("Sync");
    expect(providersAround(screen.getByTestId("shortcuts"))).toContain(
      "ShortcutConfig",
    );
  });

  it("omits only ShortcutConfig on the native mobile shells (#320)", () => {
    h.nativeMobile = true;
    renderChain();

    const chain = providersAround(screen.getByTestId("leaf"));
    expect(chain).not.toContain("ShortcutConfig");
    // Audio is deliberately NOT gated — the completion chime is part of the
    // Mobile-Full work timer (mobile-scope.md #10/#11).
    expect(chain).toEqual([
      "Toast",
      "Sync",
      "UndoRedo",
      "Audio",
      "Timer",
      "RightSidebar",
    ]);
    // The executor still mounts; it goes inert via the optional hook rather
    // than disappearing.
    expect(screen.queryByTestId("shortcuts")).not.toBeNull();
  });
});
