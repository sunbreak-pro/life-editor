import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import type { DataService, UserDataExport } from "@life-editor/shared";
import { DataExportCard } from "../src/settings/DataExportCard";
import { SettingsScreen } from "../src/settings/SettingsScreen";

/*
 * #1988 — the "download all my data" button: it shows, it stays busy for the
 * whole read, it hands the saver a dated file name and the data, and it says
 * so when the read fails. Plus the mount: on Settings > General in a browser,
 * absent inside the Capacitor shells.
 *
 * `useTranslation` echoes its key (plus interpolated values after a `|`), so
 * the assertions read as key names. No jest-dom in web/.
 */

const state = vi.hoisted(() => ({
  native: false,
  getSession: vi.fn(),
}));

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts ? `${key}|${Object.values(opts).join(",")}` : key,
    }),
    isNativeMobile: () => state.native,
    useMediaQuery: () => true,
    useThemeContext: () => ({
      theme: "light",
      themeMode: "system",
      fontSize: 3,
      fontFamily: "system",
      reduceMotion: "system",
      language: "en",
      toggleTheme: vi.fn(),
      setTheme: vi.fn(),
      setThemeMode: vi.fn(),
      setFontSize: vi.fn(),
      setFontFamily: vi.fn(),
      setReduceMotion: vi.fn(),
      setLanguage: vi.fn(),
    }),
    useShortcutConfig: () => null,
    useStartupSectionPref: () => ({ pref: "last", setPref: vi.fn() }),
    useDayStartHourPref: () => ({ dayStartHour: 4, setDayStartHour: vi.fn() }),
    useScheduleInitialViewPref: () => ({
      initialView: "week",
      setInitialView: vi.fn(),
    }),
    useTourContext: () => ({ restart: vi.fn(), startSection: vi.fn() }),
    getSession: state.getSession,
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

function exportWith(rows: number): UserDataExport {
  const tables = {
    items_meta: Array.from({ length: rows }, (_, i) => ({ id: `task-${i}` })),
  } as unknown as UserDataExport["tables"];
  return {
    schemaVersion: 1,
    exportedAt: "2026-09-26T00:00:00.000Z",
    tables,
  };
}

function makeDS(exportUserData: () => Promise<UserDataExport>): DataService {
  return { exportUserData: vi.fn(exportUserData) } as unknown as DataService;
}

const BUTTON = "settings.dataExport.button";
const BUSY = "settings.dataExport.busy";

beforeEach(() => {
  state.native = false;
  state.getSession.mockReset();
  state.getSession.mockResolvedValue({ user: { email: "me@example.com" } });
});

describe("DataExportCard (#1988)", () => {
  it("is busy for the whole read, then saves a dated file and says so", async () => {
    let finish: (value: UserDataExport) => void = () => {};
    const ds = makeDS(() => new Promise<UserDataExport>((r) => (finish = r)));
    const save = vi.fn();
    render(
      <DataExportCard
        dataService={ds}
        save={save}
        now={() => new Date(2026, 8, 26, 10, 0)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: BUTTON }));

    const busyButton = screen.getByRole("button", { name: BUSY });
    expect(busyButton.getAttribute("aria-busy")).toBe("true");
    expect((busyButton as HTMLButtonElement).disabled).toBe(true);
    expect(save).not.toHaveBeenCalled();

    const data = exportWith(1000);
    await act(async () => finish(data));

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(
      "life-editor-export-2026-09-26.json",
      data,
    );
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("settings.dataExport.done");
    expect(status.textContent).toContain("life-editor-export-2026-09-26.json");
    expect(screen.getByRole("button", { name: BUTTON })).toBeTruthy();
  });

  it("ignores a second press while the first is still running", async () => {
    let finish: (value: UserDataExport) => void = () => {};
    const ds = makeDS(() => new Promise<UserDataExport>((r) => (finish = r)));
    render(<DataExportCard dataService={ds} save={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: BUTTON }));
    fireEvent.click(screen.getByRole("button", { name: BUSY }));
    await act(async () => finish(exportWith(1)));

    expect(ds.exportUserData).toHaveBeenCalledTimes(1);
  });

  it("reports a failed read and saves nothing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const ds = makeDS(() => Promise.reject(new Error("offline")));
    const save = vi.fn();
    render(<DataExportCard dataService={ds} save={save} />);

    fireEvent.click(screen.getByRole("button", { name: BUTTON }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "settings.dataExport.error",
    );
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: BUTTON })).toBeTruthy();
    error.mockRestore();
  });

  it("reports the same failure when there is no data service at all", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<DataExportCard dataService={null} save={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: BUTTON }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "settings.dataExport.error",
    );
    error.mockRestore();
  });
});

describe("Settings mount (#1988)", () => {
  async function renderSettings() {
    // getDataService() throws without credentials, which Settings logs.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<SettingsScreen />);
    await waitFor(() => expect(state.getSession).toHaveBeenCalled());
    error.mockRestore();
  }

  it("shows the export card on General in a browser", async () => {
    await renderSettings();
    expect(screen.getByText("settings.dataExport.heading")).toBeTruthy();
    expect(screen.getByRole("button", { name: BUTTON })).toBeTruthy();
  });

  it("leaves it out inside the native mobile shells", async () => {
    state.native = true;
    await renderSettings();
    expect(screen.queryByText("settings.dataExport.heading")).toBeNull();
  });
});
