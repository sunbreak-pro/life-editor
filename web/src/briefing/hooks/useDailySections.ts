import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  eveningBodyEquals,
  extractEveningSection,
  extractIntentionSection,
  isEmptyDocJson,
  mergeEveningSection,
  mergeIntentionSection,
  normalizeIntentionText,
  type DataService,
} from "@life-editor/shared";

/** Debounce for the 宣言 textarea → section-merge save (flushed on blur). */
const INTENTION_SAVE_DEBOUNCE_MS = 800;

/*
 * Editing half of the Briefing host (extracted from BriefingScreen.tsx —
 * hooks split, zero behavior change): the 夕刊 section editor state and
 * the 宣言 textarea state, plus their persistence.
 *
 * Persistence is a SECTION-MERGE write (Risks): each save re-reads the
 * freshest daily content, replaces only its own range via
 * mergeEveningSection / mergeIntentionSection, and writes the whole
 * document back — a save from here can never clobber the 朝刊 section or
 * Daily-side edits. Both sections' writes are serialized through ONE
 * promise chain owned by this hook: two concurrent read-merge-write
 * cycles on different sections could otherwise resurrect each other's
 * stale halves, and the editor's debounced emissions and mood taps
 * cannot interleave their cycles either.
 */
export function useDailySections(
  ds: DataService,
  todayKey: string,
  dailyContent: string | null,
  setDailyContent: Dispatch<SetStateAction<string | null>>,
) {
  // ── Evening tab (#263 F-6) ───────────────────────────────────────────
  // The 夕刊 tab is a dedicated editing view of the daily's evening section.
  const eveningStored = useMemo(
    () => extractEveningSection(dailyContent),
    [dailyContent],
  );

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
  // mood tap) — mergeEveningSection keeps the freshest stored value for the
  // undefined half, so a mood tap can never write back a stale body that an
  // external edit (Daily side / another device / MCP) has since replaced.
  const persistEvening = useCallback(
    (patch: { bodyDocJson?: string | null; mood?: number | null }) => {
      saveChainRef.current = saveChainRef.current.then(async () => {
        try {
          const fresh = await ds.getDailyByDateUnified(todayKey);
          const freshContent = fresh?.content ?? "";
          const merged = mergeEveningSection(freshContent, patch);
          if (merged === freshContent) return;
          const updated = await ds.upsertDailyByDateUnified(todayKey, merged);
          setDailyContent(updated.content ?? merged);
        } catch (err) {
          console.error("[BriefingScreen] evening section save failed", err);
        }
      });
    },
    [ds, todayKey, setDailyContent],
  );

  const handleEveningUpdate = useCallback(
    (json: string) => {
      // A cleared editor round-trips to a null stored body — normalize the
      // echo target so clearing doesn't remount mid-typing.
      setLastEmittedBody(isEmptyDocJson(json) ? null : json);
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
    (lastEmittedBody === null ||
      eveningBodyEquals(lastEmittedBody, eveningStored.bodyDocJson)) &&
    (moodDraft === undefined || moodDraft === eveningStored.mood);

  // ── Intention (宣言 — Step 4) ────────────────────────────────────────
  // The morning declaration lives in the daily's 宣言 section; saves ride
  // the SAME serialized chain as the evening writes (see the hook header).
  const intentionStored = useMemo(
    () => extractIntentionSection(dailyContent),
    [dailyContent],
  );

  // Draft model (controlled textarea — no remounts): draft ?? stored is what
  // the field shows. `intentionSynced` pairs the last reconciled stored text
  // with the queue of our own not-yet-landed save values (echoes): a stored
  // change matching a queued echo is our own save landing and KEEPS the
  // draft (clearing it would eat e.g. a trailing newline typed since the
  // save); anything else is a genuinely external change (Daily side / MCP /
  // another device) and drops the draft — external wins, same rule as mood.
  // Reconciliation is the render-phase adjustment pattern on pure state
  // (no refs — idempotent under StrictMode's double render).
  const [intentionDraft, setIntentionDraft] = useState<string | undefined>(
    undefined,
  );
  const [intentionSynced, setIntentionSynced] = useState<{
    text: string | null;
    echoes: (string | null)[];
  }>({ text: intentionStored.text, echoes: [] });
  if (intentionSynced.text !== intentionStored.text) {
    const echoIdx = intentionSynced.echoes.indexOf(intentionStored.text);
    if (echoIdx < 0 && intentionDraft !== undefined) {
      setIntentionDraft(undefined);
    }
    setIntentionSynced({
      text: intentionStored.text,
      // A matching echo retires itself and any stale ones queued before it.
      echoes:
        echoIdx < 0
          ? intentionSynced.echoes
          : intentionSynced.echoes.slice(echoIdx + 1),
    });
  }

  const persistIntention = useCallback(
    (text: string) => {
      const normalized = normalizeIntentionText(text);
      setIntentionSynced((s) => ({ ...s, echoes: [...s.echoes, normalized] }));
      saveChainRef.current = saveChainRef.current.then(async () => {
        try {
          const fresh = await ds.getDailyByDateUnified(todayKey);
          const freshContent = fresh?.content ?? "";
          const merged = mergeIntentionSection(freshContent, normalized);
          if (merged === freshContent) {
            // No-op write — retire the echo queued for it.
            setIntentionSynced((s) => {
              const i = s.echoes.indexOf(normalized);
              if (i < 0) return s;
              return { ...s, echoes: s.echoes.filter((_, idx) => idx !== i) };
            });
            return;
          }
          const updated = await ds.upsertDailyByDateUnified(todayKey, merged);
          setDailyContent(updated.content ?? merged);
        } catch (err) {
          console.error("[BriefingScreen] intention section save failed", err);
        }
      });
    },
    [ds, todayKey, setDailyContent],
  );

  const intentionTimerRef = useRef<number | null>(null);
  const intentionPendingRef = useRef<string | null>(null);

  const flushIntention = useCallback(() => {
    if (intentionTimerRef.current !== null) {
      window.clearTimeout(intentionTimerRef.current);
      intentionTimerRef.current = null;
    }
    const pending = intentionPendingRef.current;
    if (pending === null) return;
    intentionPendingRef.current = null;
    persistIntention(pending);
  }, [persistIntention]);

  // Unmount (or a persist identity change) must not drop tail keystrokes.
  useEffect(() => flushIntention, [flushIntention]);

  const handleIntentionChange = useCallback(
    (text: string) => {
      setIntentionDraft(text);
      intentionPendingRef.current = text;
      if (intentionTimerRef.current !== null)
        window.clearTimeout(intentionTimerRef.current);
      intentionTimerRef.current = window.setTimeout(
        flushIntention,
        INTENTION_SAVE_DEBOUNCE_MS,
      );
    },
    [flushIntention],
  );

  const intentionText = intentionDraft ?? intentionStored.text ?? "";
  const intentionSaved =
    intentionDraft === undefined ||
    normalizeIntentionText(intentionDraft) === intentionStored.text;

  return {
    eveningStored,
    eveningGen,
    eveningMood,
    eveningSaved,
    handleEveningUpdate,
    handleSelectMood,
    intentionStored,
    intentionDraft,
    intentionText,
    intentionSaved,
    handleIntentionChange,
    flushIntention,
  };
}
