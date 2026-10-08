import { useCallback, useRef, useState, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useSaveFailureReport } from "./useSaveFailureReport";
import {
  eveningBodyEquals,
  extractEveningSection,
  isEmptyDocJson,
  mergeEveningSection,
  readDailyText,
  writeDailyText,
  type DailyNode,
  type DataService,
} from "@life-editor/shared";

/*
 * Editing half of the Briefing host (extracted from BriefingScreen.tsx —
 * hooks split, zero behavior change): the 夕刊 editor state (the day's one
 * text and the mood) plus its persistence. The 宣言 textarea and its save
 * went with the paper's declaration field (#2106, D-20261007-briefing-1 —
 * no declaration is written into the body any more).
 *
 * Persistence is a SECTION-MERGE write (Risks): each save re-reads the
 * freshest daily content, replaces only its own part via writeDailyText /
 * mergeEveningSection, and writes the whole document back — a save from here
 * can never clobber an older day's 朝刊 / 宣言 section or Daily-side edits.
 * Every write is serialized through ONE promise chain owned by this hook
 * (the evening notes join it through `queueDailyWrite`): two concurrent
 * read-merge-write cycles could otherwise resurrect each other's stale
 * halves, and the editor's debounced emissions and mood taps cannot
 * interleave their cycles either.
 */
export function useDailySections(
  ds: DataService,
  todayKey: string,
  dailyContent: string | null,
  setDailyContent: Dispatch<SetStateAction<string | null>>,
) {
  // Both writes below used to swallow their failure into the console, leaving
  // a draft on screen that looked saved until the next reload took it (#955).
  const reportSaveFailure = useSaveFailureReport();

  // ── Evening tab (#263 F-6) ───────────────────────────────────────────
  // Since #2107 the reflection field edits the day's ONE text (readDailyText:
  // the body minus the 朝刊 / 宣言 sections, the 夕刊 heading and the mood
  // line), so a day with an old Daily body shows that body here too. The
  // mood still comes off the 夕刊 section's first line.
  const eveningStored = useMemo(() => {
    const section = extractEveningSection(dailyContent);
    return {
      mood: section.mood,
      bodyDocJson: readDailyText(dailyContent),
      hasSection: section.hasSection,
    };
  }, [dailyContent]);

  // Editor remount bookkeeping (same idea as DailyView): bump the key only
  // when the STORED evening body changes from OUTSIDE this editor (sync
  // refetch / MCP / Daily-side edit). Our own save echoes match
  // lastEmittedBody and never remount, so typing keeps cursor + IME state.
  //
  // The echo test is SEMANTIC, not byte-wise (#793 — the same trap #300 hit in
  // the Daily editor): the body round-trips through a jsonb column, which hands
  // object keys back in a different order than TipTap emitted them. Under `===`
  // every save read as an outside edit, so the caption stuck on Unsaved and the
  // editor remounted on each write.
  const [lastEmittedBody, setLastEmittedBody] = useState<string | null>(null);
  const [eveningGen, setEveningGen] = useState(0);
  const [syncedBody, setSyncedBody] = useState<string | null>(
    eveningStored.bodyDocJson,
  );
  // Mood draft: undefined = no local draft (show stored), null = cleared.
  const [moodDraft, setMoodDraft] = useState<number | null | undefined>(
    undefined,
  );
  const [syncedMood, setSyncedMood] = useState<number | null>(
    eveningStored.mood,
  );
  if (syncedBody !== eveningStored.bodyDocJson) {
    if (!eveningBodyEquals(eveningStored.bodyDocJson, lastEmittedBody)) {
      setEveningGen((g) => g + 1);
    }
    setSyncedBody(eveningStored.bodyDocJson);
  }
  // Mood reconcile: when the STORED mood changes (external edit or our own
  // echo), drop a diverging local draft so the tab tracks Daily-side edits;
  // a draft the store just caught up with is kept (equal — no visual jump).
  if (syncedMood !== eveningStored.mood) {
    if (moodDraft !== undefined && moodDraft !== eveningStored.mood) {
      setMoodDraft(undefined);
    }
    setSyncedMood(eveningStored.mood);
  }

  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  // Each save carries ONLY what the user just changed (a body emission OR a
  // mood tap), applied to the freshest stored content, so a mood tap can
  // never write back a stale body that an external edit (Daily side /
  // another device / MCP) has since replaced.
  //
  // The mood tap is also the PUBLISH act (#2107): after the body write it
  // keeps `evening_published_at` in step with the mood line — stamped when a
  // day goes from unpublished to published (a re-rating keeps the first
  // stamp), and set back to null when the star is cleared, so the issue
  // number (counted off the mood line) and the timestamp never disagree.
  // A second call because `upsertDailyByDateUnified(date, content)` carries
  // content only; the column is reached by `updateDailyUnified`, which needs
  // the row id the upsert hands back (the upsert also creates a missing day).
  // The two do not land atomically, so the stamp has its own failure copy —
  // the mood line DID save, and「夕刊を保存できませんでした」would be untrue.
  // The gap heals on the next tap: `stamped` is read off the fresh row, so
  // any later rating stamps a day still missing one.
  const persistEvening = useCallback(
    (patch: { bodyDocJson: string | null } | { mood: number | null }) => {
      saveChainRef.current = saveChainRef.current.then(async () => {
        let node: DailyNode | null;
        try {
          const fresh = await ds.getDailyByDateUnified(todayKey);
          const freshContent = fresh?.content ?? "";
          const merged =
            "mood" in patch
              ? mergeEveningSection(freshContent, { mood: patch.mood })
              : writeDailyText(freshContent, patch.bodyDocJson);
          node = fresh;
          if (merged !== freshContent) {
            node = await ds.upsertDailyByDateUnified(todayKey, merged);
            setDailyContent(node.content ?? merged);
          }
        } catch (err) {
          reportSaveFailure("evening", err);
          return;
        }
        if (!("mood" in patch) || node === null) return;
        try {
          const stamped = (node.eveningPublishedAt ?? null) !== null;
          if (patch.mood !== null && !stamped) {
            await ds.updateDailyUnified(node.id, {
              eveningPublishedAt: new Date().toISOString(),
            });
          } else if (patch.mood === null && stamped) {
            await ds.updateDailyUnified(node.id, { eveningPublishedAt: null });
          }
        } catch (err) {
          reportSaveFailure("publish", err);
        }
      });
    },
    [ds, todayKey, setDailyContent, reportSaveFailure],
  );

  /**
   * Run another daily write on the SAME chain (#2107 — the evening rows'
   * notes). They read-modify-write the same row, and the row may not exist
   * yet: two chains could both find it missing and both create it.
   */
  const queueDailyWrite = useCallback((job: () => Promise<void>) => {
    saveChainRef.current = saveChainRef.current.then(job).catch(() => {
      // A job reports its own failure; the chain must survive it.
    });
  }, []);

  /*
   * The keystroke-to-debounce window (#1822).
   *
   * `eveningSaved` below compares the last EMITTED body with the stored one,
   * and the editor does not emit until its 800ms debounce fires — so for that
   * whole window both sides were the stored body and the caption said
   *「Saved」over text that was not saved. The editor now reports the change as
   * it happens (`onDirty`) and this flag covers the gap until the emission
   * takes over.
   */
  const [eveningDirty, setEveningDirty] = useState(false);
  const markEveningDirty = useCallback(() => setEveningDirty(true), []);

  const handleEveningUpdate = useCallback(
    (json: string) => {
      // A cleared editor round-trips to a null stored body — normalize the
      // echo target so clearing doesn't remount mid-typing.
      setLastEmittedBody(isEmptyDocJson(json) ? null : json);
      // The emission is now the honest source: it is either still unequal to
      // the stored body (Unsaved) or the save has landed (Saved).
      setEveningDirty(false);
      persistEvening({ bodyDocJson: json });
    },
    [persistEvening],
  );

  const eveningMood = moodDraft === undefined ? eveningStored.mood : moodDraft;

  const handleSelectMood = useCallback(
    (n: number) => {
      const next = eveningMood === n ? null : n; // tap again to clear
      setMoodDraft(next);
      persistEvening({ mood: next });
    },
    [eveningMood, persistEvening],
  );

  const eveningSaved =
    !eveningDirty &&
    (lastEmittedBody === null ||
      eveningBodyEquals(lastEmittedBody, eveningStored.bodyDocJson)) &&
    (moodDraft === undefined || moodDraft === eveningStored.mood);

  /*
   * Is there a 夕刊 to report a save state FOR? (#1822)
   *
   * On a day nobody has written, every term of `eveningSaved` is vacuously
   * true, so the caption said「Saved」next to an empty page — a receipt for a
   * write that never happened. The caption is hidden while there is nothing
   * written or being written (the rule the retired 宣言 block followed since
   * #427), and the mood counts because it is stored in that same section.
   */
  const hasEveningToReport =
    eveningDirty ||
    lastEmittedBody !== null ||
    eveningStored.bodyDocJson !== null ||
    eveningStored.mood !== null ||
    moodDraft !== undefined;

  return {
    eveningStored,
    eveningGen,
    eveningMood,
    eveningSaved,
    hasEveningToReport,
    markEveningDirty,
    handleEveningUpdate,
    handleSelectMood,
    queueDailyWrite,
  };
}
