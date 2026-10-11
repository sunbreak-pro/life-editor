/**
 * The extension-app ledger (#2162, table `extension_apps` — 0039): which
 * extension apps the owner has registered. One row per app, keyed by `slug`,
 * which is also the `source_app` its records carry and the app id its gateway
 * key points at (#2146).
 *
 * The screens create, edit and delete ledger rows (the Apps section, #2165).
 * Deleting a row keeps the app's records (0039 — `source_app` is not a FK).
 */

export interface ExtensionApp {
  /** `^[a-z][a-z0-9-]{1,31}$`. Fixed once registered (records point at it). */
  slug: string;
  name: string;
  /** Public URL the Apps list opens. http(s) only. */
  url: string | null;
  /** An icon name; the screen falls back to its default when unknown. */
  icon: string | null;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** What a caller writes when registering an app. */
export interface ExtensionAppInput {
  slug: string;
  name: string;
  url?: string | null;
  icon?: string | null;
  description?: string | null;
  /** Omitted = appended after the current last app. */
  sortOrder?: number;
}

/** What may change after registering. The slug may not (records point at it). */
export type ExtensionAppUpdates = Partial<Omit<ExtensionAppInput, "slug">>;

/** Which field a refusal is about. */
export type ExtensionAppField = "slug" | "name" | "url";

/**
 * Why a value was refused. `badSlug` is the 0039 CHECK, `taken` a slug the
 * user already registered (the primary key), `badUrl` anything but an
 * absolute http(s) URL — the Apps list renders it as a link, so a
 * `javascript:` URL must never reach it.
 */
export type ExtensionAppIssue = "empty" | "badSlug" | "badUrl" | "taken";
