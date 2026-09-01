/*
 * The desktop shell's IPC contract (#894).
 *
 * Electron's IPC is two string literals that have to agree: `ipcMain.handle`
 * in the main process and `ipcRenderer.invoke` in the preload. Nothing ties
 * them together — they are strings, so renaming one and not the other
 * compiles cleanly and passes typecheck. The failure only shows up at
 * runtime, and only in the packaged app: the invoke rejects with "No handler
 * registered", the renderer's auth init treats that as "no session", and the
 * desktop build starts asking for a login on every launch. That is exactly
 * the symptom #838 was filed for.
 *
 * So the names live here once, and both ends import them. `DesktopIpcApi` is
 * the other half — the call signature behind each channel — which the preload
 * annotates itself with, so adding a channel without a handler (or handing
 * one the wrong argument) is a compile error rather than a silent 500ms
 * rejection in production.
 *
 * This module must stay dependency-free (no `electron` import): the tests
 * load it from a plain Node context, and `shared/` compares its own
 * expectations against `DesktopAuthStorageApi` below.
 */

export type ThemePreference = "light" | "dark" | "system";

export interface WindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

/**
 * Channel names. One entry per `ipcMain.handle` / `ipcRenderer.invoke` pair.
 * Adding a channel means adding it here first — `DesktopIpcChannel` below is
 * derived from this object, so nothing else can name a channel it does not
 * contain.
 */
export const DESKTOP_IPC = {
  getTheme: "config:getTheme",
  setTheme: "config:setTheme",
  getWindowBounds: "window:getBounds",
  getAppVersion: "app:getVersion",
  authStorageGetItem: "authStorage:getItem",
  authStorageSetItem: "authStorage:setItem",
  authStorageRemoveItem: "authStorage:removeItem",
  claudeGetProjectPath: "claude:getProjectPath",
  claudeLaunch: "claude:launch",
  notifyShow: "notify:show",
} as const;

export type DesktopIpcChannel = (typeof DESKTOP_IPC)[keyof typeof DESKTOP_IPC];

/** Every channel, for the tests that check both ends cover the same set. */
export const DESKTOP_IPC_CHANNELS: readonly DesktopIpcChannel[] =
  Object.values(DESKTOP_IPC);

/**
 * Claude Code launcher (#1211).
 *
 * `projectPath` is the folder the terminal opens in, which is also what decides
 * whether `claude` finds this app's MCP server: the server is declared in the
 * repo's `.mcp.json`, so a launch from anywhere else starts a Claude that
 * cannot see the todos and notes the app is showing. Omit it and main reuses
 * the folder saved by the last successful launch — that is how the sidebar row
 * launches without carrying a text field of its own.
 */
export interface ClaudeLaunchArgs {
  projectPath?: string;
}

/**
 * Failures are named, not worded: the renderer owns copy (§6.4), so main says
 * WHICH thing went wrong and the Settings card says it in en / ja. It is also
 * why a failed launch resolves rather than rejects — every one of these is
 * something the user can fix in the field they just typed into, not an
 * exception for an error boundary.
 */
export type ClaudeLaunchError =
  | "no-project-path"
  | "invalid-project-path"
  | "claude-not-found"
  | "spawn-failed";

export interface ClaudeLaunchResult {
  ok: boolean;
  error?: ClaudeLaunchError;
}

/**
 * OS notification (#1374). Desktop-only per CLAUDE.md §2 — the browser and
 * the Capacitor shell simply have no bridge, and the renderer degrades to its
 * in-app toast without a permission prompt to raise or a rejection to handle.
 */
export interface NotifyArgs {
  title: string;
  body?: string;
}

/**
 * A main-process handler as `ipcMain.handle` accepts it. Deliberately loose
 * on arguments: every one of these validates what the renderer sent before
 * using it (the renderer can send any value regardless of the TS type), so
 * typing the parameters here would describe a promise the boundary does not
 * actually keep.
 */
export type DesktopIpcHandler = (event: unknown, ...args: unknown[]) => unknown;

/**
 * One handler per channel. Main annotates its merged handler table with this,
 * which is what makes adding a channel to `DESKTOP_IPC` without wiring it up
 * a compile error rather than a runtime "No handler registered" in the
 * packaged app.
 */
export type DesktopIpcHandlers = Record<DesktopIpcChannel, DesktopIpcHandler>;

/**
 * The auth-session storage half of the bridge (#838).
 *
 * `shared/src/services/supabaseAuthStorage.ts` declares the SAME three
 * methods on its own, because `shared/` must not import `electron` and this
 * package is not on its module graph. Its copy is exported as
 * `DesktopAuthStorageBridge` and the two are pinned against each other in
 * `desktop/tests/ipcContract.test.ts` — a signature change on either side
 * fails desktop's typecheck instead of silently half-landing.
 */
export interface DesktopAuthStorageApi {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * What the preload exposes on `window.desktop`. The preload annotates its
 * object literal with this type, so the renderer-facing surface and the
 * channels above cannot drift apart in shape.
 *
 * Risk 1 guard (#529): keep the exposed function count <= 10. Current = 9.
 */
export interface DesktopIpcApi {
  /** Read the persisted theme preference. */
  getTheme(): Promise<ThemePreference>;
  /** Persist the theme preference and apply it to the OS color scheme. */
  setTheme(theme: ThemePreference): Promise<ThemePreference>;
  /** Read the last persisted window bounds. */
  getWindowBounds(): Promise<WindowBounds>;
  /** Read the desktop app version (from package.json at runtime). */
  getAppVersion(): Promise<string>;
  /**
   * Supabase auth-session storage (#838). The packaged renderer runs on
   * file://, where localStorage is not reliably persisted, so the session is
   * stored in the main process (safeStorage-encrypted) instead. Consumed by
   * shared/src/services/supabaseAuthStorage.ts via `window.desktop.authStorage`.
   */
  authStorage: DesktopAuthStorageApi;
  /**
   * The folder the last successful `launchClaude` used, or "" when nothing has
   * been launched from this machine yet. Read by the Settings field so it
   * shows what a bare sidebar launch would actually do.
   */
  getClaudeProjectPath(): Promise<string>;
  /**
   * Open an OS terminal running `claude` (#1211). Resolves either way — see
   * `ClaudeLaunchError` for why a failure is a value and not a rejection.
   */
  launchClaude(args: ClaudeLaunchArgs): Promise<ClaudeLaunchResult>;
  /**
   * Raise an OS notification (#1374). Resolves `false` — never rejects — when
   * the platform cannot show one, so the renderer degrades to its in-app
   * toast instead of handling a rejection on a notification path.
   *
   * ⚠️ This takes the exposed surface to 10, exactly the #529 Risk 1 budget.
   * The next channel has to either raise that budget with a stated reason or
   * fold into an existing one.
   */
  notify(args: NotifyArgs): Promise<boolean>;
}
