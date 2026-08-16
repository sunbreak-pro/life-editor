/*
 * #932 — restoring a trashed routine occurrence is the one restore that can
 * legitimately be refused.
 *
 * The moment an occurrence is trashed, `is_deleted_cache` flips to true, the
 * Issue-011 partial UNIQUE stops counting it, and the generator is free to
 * mint a fresh live row for the very same (routine_item_id, source_date).
 * Restoring the trashed row then asks the DB to hold TWO live rows for that
 * pair, and the 0008 trigger's `is_deleted_cache = false` write is what gets
 * rejected with 23505 — from the caller's seat the plain `items_meta` UPDATE
 * simply explodes.
 *
 * That refusal is not a failure to report as "something went wrong": the day
 * the user is looking at already has its occurrence. So the restore paths
 * name it separately, and the callers decide what to say.
 */

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = "23505";

/** The Issue-011 partial UNIQUE (`0008_data_unification_schema.sql`). */
const ROUTINE_PAIR_CONSTRAINT = "uq_events_payload_routine_date";

/**
 * Raised when a restore was refused because a live row already holds the
 * target's (routine, date) pair. Carries every id that was turned away so a
 * bulk caller can report them together.
 */
export class ScheduleRestoreConflictError extends Error {
  readonly name = "ScheduleRestoreConflictError";
  readonly conflictedIds: string[];

  constructor(conflictedIds: string[]) {
    super(
      `restore refused for ${conflictedIds.length} schedule item(s): a live row already holds their (routine, date) pair`,
    );
    this.conflictedIds = [...conflictedIds];
  }
}

/**
 * Name-based rather than `instanceof`: shared/ is consumed by the web bundle
 * and by vitest, and a class identity that travels across module instances is
 * exactly the kind of check that fails silently in one of them.
 */
export function isScheduleRestoreConflict(
  e: unknown,
): e is ScheduleRestoreConflictError {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { name?: unknown }).name === "ScheduleRestoreConflictError"
  );
}

/**
 * Does this PostgREST error mean "that (routine, date) pair is taken"?
 *
 * The pre-check in the service drops known collisions before writing, so this
 * only fires on a race — the generator inserting the pair between our SELECT
 * and our UPDATE. `code` is the reliable half; the constraint name is checked
 * too because the mocked builders in tests (and some PostgREST error shapes)
 * carry only a message.
 */
export function isRoutinePairViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === UNIQUE_VIOLATION) return true;
  return (
    typeof message === "string" && message.includes(ROUTINE_PAIR_CONSTRAINT)
  );
}
