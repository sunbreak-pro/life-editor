import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  ExtensionAppValidationError,
  type AppRecordSource,
  type DataService,
  type ExtensionApp,
  type ExtensionAppInput,
} from "@life-editor/shared";
import { AppsScreen } from "../src/apps/AppsScreen";
import { createBumpableSync, stubDataService } from "./helpers";

/*
 * The Apps section (#2165) through its host: register → the card appears,
 * "Show records" hands the slug to the shell, the "apps that only sent
 * records" rows, the delete question, and the narrow layout's read-only list.
 *
 * No jest-dom in web/ — presence comes from getBy* throwing, absence from
 * queryBy* being null.
 */

function app(over: Partial<ExtensionApp> = {}): ExtensionApp {
  return {
    slug: "ledger",
    name: "Household ledger",
    url: "https://ledger.example.com",
    icon: null,
    description: "Where the money went",
    sortOrder: 0,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    ...over,
  };
}

function source(sourceApp: string, daysAgo = 1): AppRecordSource {
  return {
    sourceApp,
    lastRecordAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    recordsLast30Days: 3,
  };
}

function makeDS(over: Partial<Record<keyof DataService, unknown>> = {}) {
  return stubDataService({
    listExtensionApps: vi.fn().mockResolvedValue([]),
    listAppRecordSources: vi.fn().mockResolvedValue([]),
    createExtensionApp: vi.fn(async (input: ExtensionAppInput) =>
      app({
        slug: input.slug,
        name: input.name,
        url: input.url ?? null,
        icon: input.icon ?? null,
        description: input.description ?? null,
      }),
    ),
    updateExtensionApp: vi.fn(),
    deleteExtensionApp: vi.fn().mockResolvedValue(undefined),
    ...over,
  });
}

function mockMatchMedia(matches: boolean) {
  // @ts-expect-error — minimal MediaQueryList stub for jsdom, which has none.
  window.matchMedia = () => ({
    matches,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

function renderApps(ds: DataService, onShowRecords = vi.fn()) {
  const sync = createBumpableSync();
  render(
    <sync.wrapper>
      <AppsScreen dataService={ds} onShowRecords={onShowRecords} />
    </sync.wrapper>,
  );
  return { onShowRecords };
}

function card(slug: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-app-slug="${slug}"]`);
  if (!el) throw new Error(`no card for ${slug}`);
  return el;
}

function unregisteredSlugs(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-unregistered-slug]"),
  ).map((el) => el.dataset.unregisteredSlug ?? "");
}

function fillField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => mockMatchMedia(true));
afterEach(() => {
  cleanup();
  // @ts-expect-error — leave no stub behind for the next file.
  delete window.matchMedia;
});

describe("AppsScreen", () => {
  it("registers an app from the empty state and lists it", async () => {
    const ds = makeDS();
    renderApps(ds);

    const open = await screen.findByRole("button", { name: "Register an app" });
    // The empty state explains the section and points at the key procedure.
    screen.getByText(/Extension apps are small apps/);
    screen.getByText(/gateway-key/);

    fireEvent.click(open);
    const dialog = screen.getByRole("dialog");
    fillField("Slug", "scale");
    fillField("Name", "Body scale");
    fillField("URL", "https://scale.example.com");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(ds.createExtensionApp).toHaveBeenCalledWith({
      slug: "scale",
      name: "Body scale",
      url: "https://scale.example.com",
      icon: null,
      description: null,
    });
    within(card("scale")).getByText("Body scale");
    within(card("scale")).getByText("No records yet");
  });

  it("offers no register button while the first read is pending", () => {
    // The read may come back empty, and the empty state brings its own
    // button: drawing the header one first made it blink away on load.
    const ds = makeDS({
      listExtensionApps: vi.fn(() => new Promise<never>(() => {})),
    });
    renderApps(ds);

    expect(
      screen.queryByRole("button", { name: "Register an app" }),
    ).toBeNull();
    expect(screen.queryByText(/Extension apps are small apps/)).toBeNull();
  });

  it("marks a bad slug before asking the service", async () => {
    const ds = makeDS();
    renderApps(ds);

    fireEvent.click(
      await screen.findByRole("button", { name: "Register an app" }),
    );
    fillField("Slug", "Bad Slug");
    fillField("Name", "Anything");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText(/2 to 32 lowercase letters/);
    expect(ds.createExtensionApp).not.toHaveBeenCalled();
  });

  it("shows the service's `taken` refusal on the slug and stays open", async () => {
    const ds = makeDS({
      createExtensionApp: vi
        .fn()
        .mockRejectedValue(
          new ExtensionAppValidationError("slug", "taken", "test"),
        ),
    });
    renderApps(ds);

    fireEvent.click(
      await screen.findByRole("button", { name: "Register an app" }),
    );
    fillField("Slug", "ledger");
    fillField("Name", "Ledger");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText(/already registered/);
    screen.getByRole("dialog");
  });

  it("hands the slug to the shell from Show records", async () => {
    const ds = makeDS({
      listExtensionApps: vi.fn().mockResolvedValue([app()]),
      listAppRecordSources: vi.fn().mockResolvedValue([source("ledger", 3)]),
    });
    const { onShowRecords } = renderApps(ds);

    await waitFor(() => card("ledger"));
    within(card("ledger")).getByText(/Last record: 3 days ago/);
    const link = within(card("ledger")).getByRole("link", {
      name: "Open Household ledger",
    });
    expect(link.getAttribute("href")).toBe("https://ledger.example.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");

    fireEvent.click(
      within(card("ledger")).getByRole("button", { name: "Show records" }),
    );
    expect(onShowRecords).toHaveBeenCalledWith("ledger");
  });

  it("lists only unregistered sources, never `claude`, and registers one with its slug filled", async () => {
    const ds = makeDS({
      listExtensionApps: vi.fn().mockResolvedValue([app()]),
      listAppRecordSources: vi
        .fn()
        .mockResolvedValue([
          source("ledger"),
          source("claude"),
          source("sleep", 5),
          source("scale", 2),
        ]),
    });
    renderApps(ds);

    await screen.findByText("Apps that only sent records");
    // Newest record first.
    expect(unregisteredSlugs()).toEqual(["scale", "sleep"]);

    const row = document.querySelector<HTMLElement>(
      '[data-unregistered-slug="scale"]',
    )!;
    fireEvent.click(within(row).getByRole("button", { name: "Register" }));
    const slug = screen.getByLabelText("Slug") as HTMLInputElement;
    expect(slug.value).toBe("scale");
  });

  it("asks before deleting, and the app falls back to the unregistered rows", async () => {
    const ds = makeDS({
      listExtensionApps: vi.fn().mockResolvedValue([app()]),
      listAppRecordSources: vi.fn().mockResolvedValue([source("ledger")]),
    });
    renderApps(ds);

    await waitFor(() => card("ledger"));
    fireEvent.click(
      within(card("ledger")).getByRole("button", { name: "Remove" }),
    );

    const question = screen.getByRole("dialog");
    within(question).getByText(/Remove Household ledger from the list\?/);
    expect(ds.deleteExtensionApp).not.toHaveBeenCalled();

    fireEvent.click(within(question).getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(ds.deleteExtensionApp).toHaveBeenCalledWith("ledger"),
    );
    await waitFor(() => expect(unregisteredSlugs()).toEqual(["ledger"]));
    expect(document.querySelector('[data-app-slug="ledger"]')).toBeNull();
  });

  it("keeps the delete when the question is cancelled", async () => {
    const ds = makeDS({
      listExtensionApps: vi.fn().mockResolvedValue([app()]),
    });
    renderApps(ds);

    await waitFor(() => card("ledger"));
    fireEvent.click(
      within(card("ledger")).getByRole("button", { name: "Remove" }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(ds.deleteExtensionApp).not.toHaveBeenCalled();
    card("ledger");
  });

  it("edits an app with the slug read-only", async () => {
    const ds = makeDS({
      listExtensionApps: vi.fn().mockResolvedValue([app()]),
      updateExtensionApp: vi.fn(async () => app({ name: "Family ledger" })),
    });
    renderApps(ds);

    await waitFor(() => card("ledger"));
    fireEvent.click(
      within(card("ledger")).getByRole("button", { name: "Edit" }),
    );
    const slug = screen.getByLabelText("Slug") as HTMLInputElement;
    expect(slug.readOnly).toBe(true);
    fillField("Name", "Family ledger");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(ds.updateExtensionApp).toHaveBeenCalledWith("ledger", {
      name: "Family ledger",
      url: "https://ledger.example.com",
      icon: null,
      description: "Where the money went",
    });
    within(card("ledger")).getByText("Family ledger");
  });

  it("says the read failed instead of showing the empty state", async () => {
    const ds = makeDS({
      listExtensionApps: vi.fn().mockRejectedValue(new Error("offline")),
    });
    renderApps(ds);

    await screen.findByText(/apps could not be loaded/);
    expect(screen.queryByText(/Extension apps are small apps/)).toBeNull();
  });

  it("is read-only on the narrow layout: open and show records, nothing else", async () => {
    mockMatchMedia(false);
    const ds = makeDS({
      listExtensionApps: vi.fn().mockResolvedValue([app()]),
      listAppRecordSources: vi
        .fn()
        .mockResolvedValue([source("ledger"), source("scale")]),
    });
    renderApps(ds);

    await waitFor(() => card("ledger"));
    within(card("ledger")).getByRole("button", { name: "Show records" });
    within(card("ledger")).getByRole("link", { name: "Open Household ledger" });
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Register an app" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Register" })).toBeNull();
    expect(unregisteredSlugs()).toEqual(["scale"]);
  });
});
