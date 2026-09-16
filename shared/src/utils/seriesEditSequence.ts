/*
 * The order a series-wide edit has to be written in (#504).
 *
 * A repeat is two things at once: a TEMPLATE that future days are generated
 * from, and the OCCURRENCE rows already sitting on the calendar. An edit
 * applied to "this and future" / "all" has to reach both, and the order is not
 * a matter of taste:
 *
 *   - Occurrences first (the old order) puts the failure where nobody can see
 *     it. Every future row on screen carries the new values, so the screen is
 *     entirely right; only the template kept the old ones, and that shows up
 *     days later as freshly generated occurrences quietly reverting. A reload
 *     cannot reveal it either — the rows really are correct.
 *   - Template first makes that state unreachable. If the template write does
 *     not land, no occurrence has been touched, so "nothing was saved" is a
 *     promise the caller can actually keep (and its reload snaps any
 *     optimistic patch back to DB truth).
 *
 * `prepare` runs ahead of both. It exists for the "this and future" scope,
 * where the days BEFORE the anchor have to be materialised while the template
 * still holds the pre-edit values — they are the days the user did not select,
 * and they only exist on demand.
 *
 * Nothing here talks to a service: every step is injected, which is what lets
 * the ordering be tested rather than re-derived at each call site.
 */

import type { ScheduleItem } from "../types/schedule";
import {
  seriesPropagatableFields,
  type SeriesUpdates,
} from "./eventEditorSave";
import { addDaysKey } from "./scheduleGridLayout";

export type SeriesEditOutcome =
  | "ok"
  /** `prepare` reported it did not fully land — nothing after it ran. */
  | "prepare-failed"
  /** The template write did not land — NO occurrence was touched. */
  | "template-failed"
  /**
   * The template landed but the occurrences did not. The half-written state is
   * at least VISIBLE (the future rows on screen keep the old values while new
   * ones will generate with the new), unlike the ordering this file exists to
   * prevent — but visible is not the same as explained, so it gets its own
   * verdict rather than sharing "ok" or "template-failed".
   */
  | "propagate-failed";

export interface SeriesEditSteps {
  /**
   * Optional pre-step that must complete against the PRE-edit template.
   * Resolve `false` to abort (a thrown error propagates to the caller, which
   * is the existing behaviour for these writes).
   */
  prepare?: () => Promise<boolean>;
  /** Write the template. Resolve `false` when it did not land. */
  writeTemplate: () => Promise<boolean>;
  /**
   * Push the same change onto the already-materialised occurrences. Resolve
   * `false` when it did not land — same convention as the two steps above, so
   * a caller whose propagation throws has to decide what a throw means instead
   * of dropping it into a bare `catch`.
   */
  propagate: () => Promise<boolean>;
}

export async function runSeriesEdit(
  steps: SeriesEditSteps,
): Promise<SeriesEditOutcome> {
  if (steps.prepare) {
    const prepared = await steps.prepare();
    if (!prepared) return "prepare-failed";
  }
  const landed = await steps.writeTemplate();
  if (!landed) return "template-failed";
  const propagated = await steps.propagate();
  if (!propagated) return "propagate-failed";
  return "ok";
}

/*
 * ── Which write a chosen scope means (#1642 W7) ───────────────────────────
 *
 * `handleScopeChoose` used to be one 209-line function: six branches, the
 * pre-anchor fill arithmetic, and every service call, in one body. The
 * DECISION part is pure — it reads the parked request, the scope, the routine
 * as it stands and today's date, and nothing else — so it lives here, next to
 * the ordering rule it feeds, and the hook is left with the writing.
 *
 * Splitting it this way is what makes the six branches testable without a
 * jsdom host: the plan is data, and a test can read it.
 */

/**
 * The days that have to be materialised BEFORE a series is mutated, or null
 * when there are none.
 *
 * A future-dated anchor is the whole reason this exists: the days between
 * today and the anchor only exist on demand, and both a detach and a template
 * rewrite would otherwise erase or rewrite days the user did not select. The
 * fill has to carry the PRE-edit template, so it runs first.
 */
export interface SeriesFillRange {
  startDate: string;
  endDate: string;
}

export function fillRangeUpToAnchor(
  anchor: string,
  today: string,
): SeriesFillRange | null {
  // An anchor at or before today needs nothing: those days are already on the
  // calendar (or are in the past, where nothing is generated).
  if (anchor <= today) return null;
  const endDate = addDaysKey(anchor, -1);
  if (today > endDate) return null;
  return { startDate: today, endDate };
}

/** The parked this/future/all question, as the planner reads it. */
export interface RepeatScopeRequest {
  mode: "edit" | "delete";
  item: { id: string; date: string; routineId?: string | null };
  patch?: Partial<ScheduleItem>;
}

/** The routine values an edit propagates from — its PRE-edit title / times. */
export interface SeriesTemplateValues {
  title: string;
  startTime: string | null;
  endTime: string | null;
}

/**
 * What the chosen scope amounts to. One variant per branch of the old
 * function, carrying everything the write needs and nothing it can re-derive.
 */
export type RepeatScopePlan =
  /** The row turned out not to belong to a series — write nothing. */
  | { kind: "none" }
  /**
   * One row, one patch. Both "edit / this" AND the degraded path where the
   * routine is not loaded: propagating without the pre-edit template would
   * drop the manual-edit protection (tier-1 §Schedule rule 2), so a
   * this-only edit is the honest fallback.
   */
  | { kind: "patch-occurrence"; id: string; patch: Partial<ScheduleItem> }
  /** Template + the still-unedited materialised rows from `fromDate`. */
  | {
      kind: "edit-series";
      routineId: string;
      id: string;
      patch: Partial<ScheduleItem>;
      updates: SeriesUpdates;
      template: SeriesTemplateValues;
      /** "0000-01-01" for "all" — every occurrence ever materialised. */
      fromDate: string;
      fill: SeriesFillRange | null;
    }
  /** "delete / this" is a DISMISS: a plain delete gets revived (Issue 017). */
  | { kind: "dismiss-occurrence"; id: string }
  /** "delete / future": past and completed days survive as detached records. */
  | {
      kind: "detach-series";
      routineId: string;
      id: string;
      anchor: string;
      fill: SeriesFillRange | null;
      /** The fill wrote rows inside the visible range — re-read after it. */
      reloadAfterFill: boolean;
    }
  /** "delete / all": soft-delete the routine with its cascade. */
  | { kind: "delete-series"; routineId: string; id: string };

export function planRepeatScopeChoice(input: {
  request: RepeatScopeRequest;
  scope: "this" | "future" | "all";
  /** The routine as the store has it, or undefined when it is not loaded. */
  routine: SeriesTemplateValues | undefined;
  today: string;
}): RepeatScopePlan {
  const { request, scope, routine, today } = input;
  const routineId = request.item.routineId;
  if (!routineId) return { kind: "none" };
  const id = request.item.id;

  if (request.mode === "edit") {
    const patch = request.patch ?? {};
    if (scope === "this" || !routine) {
      return { kind: "patch-occurrence", id, patch };
    }
    return {
      kind: "edit-series",
      routineId,
      id,
      patch,
      // The same rule that decided to ask in the first place, so the template
      // can never receive a field the question did not cover — e.g. the
      // fallback span an all-day flip drags along (#469).
      updates: seriesPropagatableFields(patch),
      template: {
        title: routine.title,
        startTime: routine.startTime,
        endTime: routine.endTime,
      },
      fromDate: scope === "future" ? request.item.date : "0000-01-01",
      fill:
        scope === "future"
          ? fillRangeUpToAnchor(request.item.date, today)
          : null,
    };
  }

  if (scope === "this") return { kind: "dismiss-occurrence", id };
  if (scope === "future") {
    return {
      kind: "detach-series",
      routineId,
      id,
      anchor: request.item.date,
      // No routine, no fill: there is nothing to generate the missing days
      // from, and the detach goes ahead on what is already there.
      fill: routine ? fillRangeUpToAnchor(request.item.date, today) : null,
      reloadAfterFill: routine != null && request.item.date > today,
    };
  }
  return { kind: "delete-series", routineId, id };
}
