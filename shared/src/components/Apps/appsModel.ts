import type { AppRecordSource } from "../../types/appRecord";
import { APP_RECORD_SOURCE_CLAUDE } from "../../types/appRecord";
import type { ExtensionApp } from "../../types/extensionApp";
import type { AppsListEntry, AppsUnregisteredSource } from "./types";

/*
 * The Apps section's one derivation (#2165): the ledger and the record sources
 * are two reads, and the screen draws them as "registered apps, each with its
 * last record" plus "sources nobody registered".
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AppsModel {
  registered: AppsListEntry[];
  unregistered: AppsUnregisteredSource[];
}

/**
 * Join the ledger with the record sources.
 *
 * `claude` is never an unregistered app: it is the owner's own Claude over MCP
 * (APP_RECORD_SOURCE_CLAUDE), not something you could register. Registered
 * apps keep the ledger's order (sort_order, then slug — the service's order);
 * unregistered ones go newest record first, since the one that just started
 * sending is the one you came here to register.
 */
export function buildAppsModel(
  apps: readonly ExtensionApp[],
  sources: readonly AppRecordSource[],
): AppsModel {
  const bySlug = new Map(sources.map((s) => [s.sourceApp, s]));
  const registeredSlugs = new Set(apps.map((a) => a.slug));
  const registered = apps.map((app) => {
    const source = bySlug.get(app.slug);
    return {
      slug: app.slug,
      name: app.name,
      url: app.url,
      icon: app.icon,
      description: app.description,
      lastRecordAt: source?.lastRecordAt ?? null,
      recordsLast30Days: source?.recordsLast30Days ?? 0,
    };
  });
  const unregistered = sources
    .filter(
      (s) =>
        s.sourceApp !== APP_RECORD_SOURCE_CLAUDE &&
        !registeredSlugs.has(s.sourceApp),
    )
    .map((s) => ({
      slug: s.sourceApp,
      lastRecordAt: s.lastRecordAt,
      recordsLast30Days: s.recordsLast30Days,
    }))
    .sort((a, b) => b.lastRecordAt.localeCompare(a.lastRecordAt));
  return { registered, unregistered };
}

/**
 * Whole days between an instant and now, never negative (a record stamped a
 * little in the future — another device's clock — reads as today).
 */
export function daysSince(iso: string, now: number): number {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return 0;
  return Math.max(0, Math.floor((now - at) / DAY_MS));
}
