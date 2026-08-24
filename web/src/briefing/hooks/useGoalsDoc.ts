import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSaveFailureReport } from "./useSaveFailureReport";
import {
  GOALS_NOTE_ID,
  GOAL_PERIODS,
  adoptBareGoalHeadings,
  extractGoals,
  goalPeriodKeys,
  mergeGoalSection,
  normalizeGoalText,
  useSyncDomains,
  useTranslation,
  type DataService,
  type ExtractedGoals,
  type GoalPeriod,
  WEEK_STARTS_ON,
} from "@life-editor/shared";

/** Debounce for a goal textarea → section-merge save (flushed on blur). */
const GOAL_SAVE_DEBOUNCE_MS = 800;

/*
 * The goals note (#872) — read, draft and save of the 週 / 月 / 年 goals the
 * morning paper keeps on display.
 *
 * Storage is ONE reserved note (`note-goals`) whose body carries the three
 * heading sections (shared/src/components/briefing/goalSections.ts). Two
 * consequences shape this hook:
 *
 * - The list read does NOT carry bodies (`listNotesUnified` returns
 *   `content: ""` — SupabaseNotesUnifiedReads), so the note is fetched by id
 *   with `getNoteUnified`.
 * - The note is created on the FIRST SAVE ONLY. Opening the paper must not
 *   create an empty note in Notes, so a save whose merge is a no-op (nothing
 *   typed) writes nothing at all.
 *
 * Persistence is a SECTION-MERGE write on ONE serialized chain, exactly like
 * useDailySections: each save re-reads the freshest body, replaces only its own
 * period's range, and writes the whole document back — so saving the month goal
 * can never resurrect a stale week goal or clobber a Notes-side edit.
 *
 * Since #957 every section carries a PERIOD KEY, so "its own range" means the
 * CURRENT week / month / year. When a period turns over, its field is empty
 * because that key has no section yet, and the previous one stays in the note
 * as history the user reads from Notes. The keys come from the same call the
 * paper's period labels do (goalPeriods.ts), so key and label always agree.
 *
 * The REFETCH rides that same chain (useDailySections' daily is refetched by
 * its owner hook; this document's is not). A sync-driven read issued between
 * two saves would otherwise resolve last with a body from before the second
 * save and roll the shown text back for no reason the user can see.
 *
 * The echo test is SEMANTIC, not byte-wise (#793): the body round-trips through
 * a jsonb column that hands object keys back in another order, so a save's own
 * echo would never match under `===` on the raw JSON. What is compared here is
 * the EXTRACTED text per period — the same value the field shows.
 */

type GoalDrafts = Partial<Record<GoalPeriod, string>>;
type GoalEchoes = Record<GoalPeriod, (string | null)[]>;

const NO_ECHOES: GoalEchoes = { week: [], month: [], year: [] };

export function useGoalsDoc(ds: DataService, todayKey: string) {
  const { t } = useTranslation();
  // The save path used to swallow its failure into the console, leaving a
  // draft on screen that looked saved until the next reload took it (#955).
  const reportSaveFailure = useSaveFailureReport();
  // Which week / month / year the paper is standing in (#957). The SAME two
  // inputs produce the label beside each field (goalPeriodRanges), so the key
  // a save writes and the range the reader sees can never disagree. The week
  // start is fixed (#1102), which is what keeps a stored key from moving under
  // a goal that was already written.
  const keys = useMemo(() => goalPeriodKeys(todayKey, WEEK_STARTS_ON), [todayKey]);
  // The goals live in a note, so a Realtime note change (Notes-side edit,
  // another device) must bring the paper along — under-declaring here is a
  // silent stale (rules/frontend.md §Sync).
  const syncVersion = useSyncDomains("notes");

  const [content, setContent] = useState<string | null>(null);
  // The paper must not offer the fields before the note has answered. They
  // would render empty over goals that DO exist, and a character typed into
  // that window is both lost (the arriving note drops the draft) and
  // destructive (the queued debounce still fires and overwrites the stored
  // goal with it). The host folds this into the paper's existing skeleton
  // gate, so the goals are covered exactly like the daily's own fields.
  const [goalsLoading, setGoalsLoading] = useState(true);

  // ONE chain for the read AND the writes (see the header): a refetch that
  // resolves after a later save would otherwise roll the shown text back to a
  // body read before that save landed.
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    saveChainRef.current = saveChainRef.current.then(async () => {
      try {
        const note = await ds.getNoteUnified(GOALS_NOTE_ID);
        let body = note?.content ?? null;
        // One-shot rollover migration (#957): a note written before period
        // keys existed carries BARE headings, and left alone they would be
        // re-adopted as "this week" every week and never roll over. Rewriting
        // them here is the only write the paper makes without the user typing,
        // and it is bounded — the second read finds keyed headings and
        // `adoptBareGoalHeadings` returns its input by identity.
        //
        // Guarded on an existing, live note: never create one (opening the
        // paper must not litter Notes), and never resurrect a trashed one
        // (that is a repair the user asks for by writing a goal — persistGoal
        // owns it). Deliberately inside the read's own try/catch, so the
        // failure paths this hook has stay at two.
        if (note !== null && note.isDeleted !== true) {
          const adopted = adoptBareGoalHeadings(body, keys);
          if (adopted !== (body ?? "")) {
            const updated = await ds.updateNoteUnified(GOALS_NOTE_ID, {
              content: adopted,
            });
            body = updated.content ?? adopted;
          }
        }
        if (!cancelled) setContent(body);
      } catch (err) {
        // A failed read leaves the previous text on the paper rather than
        // blanking fields the user may be typing into — but it must still
        // open the gate, or a hiccup strands the reader on the skeleton.
        //
        // The ONE catch on this hook that does not raise a toast (#955), on
        // purpose: nothing the user typed is at stake here. A failed read
        // shows the previous text, and a failed keying migration just leaves
        // the headings bare for the next open to retry. Toasting a fetch on
        // page load would also fire on every offline open, which trains the
        // user to dismiss the notice that DOES mean lost writing.
        console.error("[BriefingScreen] goals note fetch failed", err);
      } finally {
        if (!cancelled) setGoalsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ds, syncVersion, keys]);

  const stored = useMemo<ExtractedGoals>(
    () => extractGoals(content, keys),
    [content, keys],
  );

  // Draft model (controlled textareas — no remounts): draft ?? stored is what
  // each field shows. `synced` pairs the last reconciled stored text of a
  // period with the queue of our own not-yet-landed save values (echoes): a
  // stored change matching a queued echo is our own save landing and KEEPS the
  // draft; anything else is a genuinely external change and drops it — external
  // wins, the same rule as the 宣言 field. Render-phase adjustment on pure
  // state (no refs — idempotent under StrictMode's double render).
  const [drafts, setDrafts] = useState<GoalDrafts>({});
  const [synced, setSynced] = useState<{
    text: ExtractedGoals;
    echoes: GoalEchoes;
  }>({ text: stored, echoes: NO_ECHOES });

  if (GOAL_PERIODS.some((p) => synced.text[p] !== stored[p])) {
    const echoes: GoalEchoes = { ...synced.echoes };
    const dropped: GoalPeriod[] = [];
    for (const period of GOAL_PERIODS) {
      if (synced.text[period] === stored[period]) continue;
      const idx = echoes[period].indexOf(stored[period]);
      // A matching echo retires itself and any stale ones queued before it.
      if (idx < 0) dropped.push(period);
      else echoes[period] = echoes[period].slice(idx + 1);
    }
    if (dropped.length > 0) {
      setDrafts((current) => {
        const next = { ...current };
        let changed = false;
        for (const period of dropped) {
          if (next[period] === undefined) continue;
          delete next[period];
          changed = true;
        }
        return changed ? next : current;
      });
    }
    setSynced({ text: stored, echoes });
  }

  const noteTitle = t("briefing.goals.noteTitle");

  const persistGoal = useCallback(
    (period: GoalPeriod, text: string) => {
      const normalized = normalizeGoalText(text);
      setSynced((s) => ({
        ...s,
        echoes: { ...s.echoes, [period]: [...s.echoes[period], normalized] },
      }));
      const retireEcho = () =>
        setSynced((s) => {
          const i = s.echoes[period].indexOf(normalized);
          if (i < 0) return s;
          return {
            ...s,
            echoes: {
              ...s.echoes,
              [period]: s.echoes[period].filter((_, idx) => idx !== i),
            },
          };
        });
      saveChainRef.current = saveChainRef.current.then(async () => {
        try {
          const fresh = await ds.getNoteUnified(GOALS_NOTE_ID);
          const freshContent = fresh?.content ?? "";
          const merged = mergeGoalSection(
            freshContent,
            period,
            keys[period],
            normalized,
          );
          if (merged === freshContent) {
            // No-op write (and, on a missing note, no note) — retire the echo.
            retireEcho();
            return;
          }
          if (fresh === null) {
            const now = new Date().toISOString();
            const created = await ds.createNoteUnified({
              id: GOALS_NOTE_ID,
              type: "note",
              title: noteTitle,
              content: merged,
              parentId: null,
              order: 0,
              isPinned: false,
              isDeleted: false,
              createdAt: now,
              updatedAt: now,
            });
            setContent(created.content ?? merged);
            return;
          }
          // The note may be in the trash (deleted from Notes): `getNoteUnified`
          // does not filter on `is_deleted`, so the paper keeps showing it and
          // would keep writing into it — invisible from Notes, and gone the
          // moment the trash is emptied. Writing a goal brings it back, which
          // is also the only repair path the user has from here.
          if (fresh.isDeleted === true) {
            await ds.restoreNoteUnified(GOALS_NOTE_ID);
          }
          const updated = await ds.updateNoteUnified(GOALS_NOTE_ID, {
            content: merged,
          });
          setContent(updated.content ?? merged);
        } catch (err) {
          reportSaveFailure("goals", err);
        }
      });
    },
    [ds, noteTitle, keys, reportSaveFailure],
  );

  const timersRef = useRef<Partial<Record<GoalPeriod, number>>>({});
  const pendingRef = useRef<GoalDrafts>({});

  const flushGoal = useCallback(
    (period: GoalPeriod) => {
      const timer = timersRef.current[period];
      if (timer !== undefined) {
        window.clearTimeout(timer);
        delete timersRef.current[period];
      }
      const pending = pendingRef.current[period];
      if (pending === undefined) return;
      delete pendingRef.current[period];
      persistGoal(period, pending);
    },
    [persistGoal],
  );

  const flushGoals = useCallback(() => {
    for (const period of GOAL_PERIODS) flushGoal(period);
  }, [flushGoal]);

  // Unmount (or a persist identity change) must not drop tail keystrokes.
  useEffect(() => flushGoals, [flushGoals]);

  const handleGoalChange = useCallback(
    (period: GoalPeriod, text: string) => {
      setDrafts((current) => ({ ...current, [period]: text }));
      pendingRef.current[period] = text;
      const timer = timersRef.current[period];
      if (timer !== undefined) window.clearTimeout(timer);
      timersRef.current[period] = window.setTimeout(
        () => flushGoal(period),
        GOAL_SAVE_DEBOUNCE_MS,
      );
    },
    [flushGoal],
  );

  const goals = useMemo<Record<GoalPeriod, string>>(
    () => ({
      week: drafts.week ?? stored.week ?? "",
      month: drafts.month ?? stored.month ?? "",
      year: drafts.year ?? stored.year ?? "",
    }),
    [drafts, stored],
  );

  return { goals, goalsLoading, handleGoalChange, flushGoals };
}
