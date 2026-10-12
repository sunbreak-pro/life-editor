/*
 * The one name an extension app goes by (#2166, plan
 * 2026-10-08-extension-app-records-and-apps-section.md §Risks "窓口との二重の
 * identity").
 *
 * An app is named in three places, and all three hold the same value:
 *   - the gateway key's app (`LIFE_EDITOR_GATEWAY_APPS` apps[].app, #2146);
 *   - `items_meta.origin_app`, stamped from that key on what the app creates
 *     (0038, #2147 / #2148);
 *   - `app_records.source_app`, forced to that key on what the app records.
 * That value is `extension_apps.slug` (0039), whose CHECK is the pattern below.
 * 0038's CHECK on origin_app is wider (^[a-z][a-z0-9-]{0,39}$: 1-40
 * characters, so it also admits names shorter and longer than a slug); every
 * slug fits inside it, so no DDL changes.
 *
 * `claude` is reserved: it is the owner's own MCP (stdio and the phone's
 * Remote MCP) as a record's source. No key may carry it, or an app could write
 * records that read as the owner's.
 */

/** extension_apps.slug's CHECK (0039). */
export const APP_SLUG_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;

/** `source_app` of what the owner's own Claude records; never an app's slug. */
export const RESERVED_SOURCE_APP = "claude";

/** Whether `name` can name an extension app: a slug, and not the reserved one. */
export function isAppSlug(name: string): boolean {
  return name !== RESERVED_SOURCE_APP && APP_SLUG_PATTERN.test(name);
}
