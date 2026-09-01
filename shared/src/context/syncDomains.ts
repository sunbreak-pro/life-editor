/*
 * Sync domains (#499) — which part of the app a Realtime change actually
 * affects.
 *
 * Until now every owned-table change bumped ONE counter and every mounted
 * domain refetched everything it had. Editing a note therefore re-pulled the
 * todo tree, the daily list, the tag graph, the timer settings and the sound
 * settings — and, because Realtime echoes a tab's OWN writes back to it, the
 * five PATCHes of a single note edit turned into four full sweeps (~86 REST
 * requests, measured on origin/main c2b359c6).
 *
 * Mapping each table to a domain lets a consumer depend only on the counter it
 * cares about. A note edit now moves `notes` (and `tags` when the tag graph is
 * touched); the timer and audio counters never move, so their fetches — one of
 * which WRITES, see SupabaseTimerService.fetchTimerSettings — never run.
 *
 * This is deliberately still coarse: within a domain the refetch is unchanged
 * (a note edit re-pulls the whole note list). Narrowing to the changed row is a
 * separate, larger change; the table→domain split is what removes the
 * cross-domain traffic, which is the bulk of it.
 */

/*
 * NOTE: this array is the ONLY declaration of the domain vocabulary — the
 * `SyncDomain` union, `uniformDomainVersions` and every Sync stub in the test
 * suites derive from it. Never hand-write a `Record<SyncDomain, number>`
 * literal; a new domain would then silently miss that stub.
 */
export const SYNC_DOMAINS = [
  "todos",
  "notes",
  "dailies",
  "schedule",
  "tags",
  // #1173: the saved multi-tag filters, split off `tags` for the #993 reason
  // in reverse. Their two tables are read only by the Schedule section's
  // TagGroupProvider, while the `tags` counter moves on every tag edit AND
  // every assignment — sharing it would re-pull the group list on each of
  // those, and (worse, since the traffic is bigger) saving a group would
  // re-pull the whole tag graph: tags + fully-paginated assignments +
  // connections, which is what WikiTagsUnifiedProvider does on a `tags` bump.
  "tagGroups",
  "timer",
  "audio",
  // #993: the timer SESSION LOG, split off the `timer` domain. The log is
  // write-heavy (a row per start / pause / reset / phase end) while its only
  // reader is Briefing's streak + work/break widgets; the settings and preset
  // tables it used to share a counter with are read by TimerProvider, whose
  // fetchTimerSettings materialises a row. One counter for both meant every
  // pomodoro transition re-ran two settings fetches that could not have
  // changed.
  "sessions",
] as const;

export type SyncDomain = (typeof SYNC_DOMAINS)[number];

/** The four domains that live in `items_meta` — see ITEMS_META_ROLE_DOMAIN. */
const ITEM_DOMAINS: readonly SyncDomain[] = [
  "todos",
  "notes",
  "dailies",
  "schedule",
];

/**
 * `items_meta` is shared by all five roles, so the row's own `role` decides
 * which domain moved. Events and routines both belong to Schedule (a routine
 * is an Event template — CLAUDE.md §4).
 */
const ITEMS_META_ROLE_DOMAIN: Readonly<Record<string, SyncDomain>> = {
  task: "todos",
  note: "notes",
  daily: "dailies",
  event: "schedule",
  routine: "schedule",
};

/**
 * Every table in REALTIME_TABLES maps here. `items_meta` is absent on purpose
 * — it is role-routed above, not table-routed. The lockstep test
 * (syncDomains.test.ts) fails if the two lists ever drift apart, because a
 * table with no domain would silently stop triggering any refetch at all.
 */
export const TABLE_DOMAIN: Readonly<Record<string, SyncDomain>> = {
  tasks_payload: "todos",
  notes_payload: "notes",
  dailies_payload: "dailies",
  events_payload: "schedule",
  routines_payload: "schedule",
  routine_groups: "schedule",
  routine_group_assignments: "schedule",
  // (`calendars` sat here until #1277 dropped the table — #1173 had already
  // removed the code, leaving a silent subscription that routed to `schedule`.
  // Both lists lost it together; the lockstep test would fail if either had
  // kept it.)
  wiki_tags: "tags",
  wiki_tag_groups: "tagGroups",
  wiki_tag_group_assignments: "tagGroups",
  wiki_tag_assignments: "tags",
  wiki_tag_connections: "tags",
  timer_settings: "timer",
  pomodoro_presets: "timer",
  // #993: its own domain — see SYNC_DOMAINS.
  timer_sessions: "sessions",
  sound_settings: "audio",
  playlists: "audio",
  playlist_items: "audio",
};

/** The `role` column as Realtime delivers it, if the payload carries one. */
function readRole(row: unknown): string | undefined {
  if (!row || typeof row !== "object") return undefined;
  const role = (row as { role?: unknown }).role;
  return typeof role === "string" ? role : undefined;
}

/**
 * Domains a change to `table` should bump.
 *
 * For `items_meta` the role is read from the changed row. A DELETE carries
 * only the replica-identity columns (the primary key, by default), so the role
 * is often missing there — an unknown role bumps ALL four item domains rather
 * than guessing, since a missed bump shows up as stale data the user cannot
 * refresh, while an extra bump only costs a fetch. Soft deletes are UPDATEs
 * (`is_deleted`), so the app's own deletions do carry the role.
 */
export function domainsForChange(
  table: string,
  newRow?: unknown,
  oldRow?: unknown,
): readonly SyncDomain[] {
  if (table === "items_meta") {
    const role = readRole(newRow) ?? readRole(oldRow);
    const domain = role ? ITEMS_META_ROLE_DOMAIN[role] : undefined;
    return domain ? [domain] : ITEM_DOMAINS;
  }
  const domain = TABLE_DOMAIN[table];
  return domain ? [domain] : [];
}

/**
 * Every domain on the same counter — the "everything moved (or nothing has
 * yet)" shape. Used for the Provider's initial state, and by hosts/tests that
 * want the pre-#499 coarse behaviour from a single number.
 */
export function uniformDomainVersions(
  version: number,
): Record<SyncDomain, number> {
  return Object.fromEntries(SYNC_DOMAINS.map((d) => [d, version])) as Record<
    SyncDomain,
    number
  >;
}
