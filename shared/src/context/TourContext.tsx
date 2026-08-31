import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  resolveTourStepAnchor,
  TOUR_ANCHOR_TIMEOUT_MS,
} from "../components/tour/anchor";
import { TOUR_STEPS } from "../components/tour/registry";
import { type TourProgress, type TourStep } from "../components/tour/types";
import { useTourProgress } from "../hooks/useTourProgress";
import type { SectionId } from "../sections";
import { TourContext, type TourContextValue } from "./TourContextValue";

/*
 * Tutorial tour Provider (#1122).
 *
 * GLOBAL-layer Provider (rules/frontend.md §Provider 順序): a tour crosses
 * sections, and a section-layer Provider is torn down on every navigation —
 * which is precisely the moment the tour has to survive.
 *
 * It owns three things and nothing else: WHERE the user is, WHETHER the
 * current step can be shown, and WHEN to move on. Drawing is TourOverlay's
 * job, storage is useTourProgress's, and the section switch belongs to the
 * host — shared must not reach into web's navigation, so `currentSection` and
 * `onNavigateToSection` are injected the same way `dataService` is (§6.4).
 *
 * THE ONE SUBTLE PART is that a step is not displayable the moment it becomes
 * current. Its section may still be mounting — and that section body may be a
 * code-split chunk still being fetched — so the anchor arrives some renders
 * later. The Provider therefore PROBES: it asks the host to navigate, then
 * looks for the anchor once per frame until a wall-clock deadline
 * (TOUR_ANCHOR_TIMEOUT_MS). Giving up is what the Issue's fallback requires —
 * a control that is mobile-omitted or gone from a redesigned layout must cost
 * its own step, not the whole tour.
 *
 * A tour that skipped its way to the end WITHOUT ever showing a step does not
 * mark itself complete. That case is not "the user finished"; it is "none of
 * the anchors exist yet", which is exactly the state of the app until the
 * section Issues add them. Marking it complete there would silently retire the
 * tour before anyone saw it.
 *
 * GIVING UP HAS A DIRECTION (#1193). Skipping forward is right for a fresh
 * run — it is scanning for the first anchor the app actually has. It is wrong
 * for a RESUMED one, because the position that was stored is precisely a step
 * the user had reached, and the later steps in a section are the ones that
 * assume what the earlier ones set up: a note is selected, the todo tab is
 * open. A reload destroys exactly that, so walking forward from the stored
 * point meets the same class of anchor every time and the run ends having
 * shown nothing. Since a run that showed nothing does not move the resume
 * point (above), the next reload repeats it — the tour is never seen again,
 * with its progress sitting there saying it is unfinished.
 *
 * So a resumed run that has not managed to show anything yet walks BACKWARD
 * instead, to a step whose anchor stands on its own. That both lands and
 * REBUILDS the state the stored step needed: the user is asked to make a note
 * again, and making one selects it, which is what puts the later anchors back
 * in the document. Once any step has been shown the direction flips forward
 * for the rest of the run — from there the user is walking the tour, not
 * recovering a position.
 *
 * A RUN CAN BE ONE SECTION WIDE (#1194). `startSection` swaps the list the run
 * walks for that section's slice of it, which costs the runtime nothing: every
 * mechanism above — the probe, the give-up, the counter, the end — already
 * works off "the list this run is walking" rather than off the registry.
 *
 * What a partial run does NOT do is answer the question the persisted
 * progress exists for — has this user been offered the whole tour and
 * finished or refused it. A section replay is not an answer to it. Letting
 * one write `stepId` / `completed` / `skipped` would either mark the tour
 * complete after four Materials steps or, on a Skip, retire the tour for good
 * over a "not this bit". `persist` is the single choke point, so the seal is
 * one guard rather than a rule every caller has to remember.
 *
 * A partial run does keep ONE thing (#1359): `sectionStepId`, where it stood
 * when it was closed, so re-picking that section continues instead of
 * starting over — the same courtesy the full run has always had. It is a
 * SEPARATE FIELD rather than a share of `stepId`, and that is the whole
 * design. `start` resumes at `stepId` and the end of a run writes
 * `completed`, so a replay allowed to move `stepId` would open the full tour
 * at a step the user never walked to and spend it on the next "Next" — the
 * exact harm the seal above exists to prevent, arriving by the back door.
 * Two fields, two readers, no crossing: `start` reads `stepId`,
 * `startSection` reads `sectionStepId`.
 */

/** Monotonic-ish clock, falling back where `performance` is absent. */
const now = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export interface TourProviderProps {
  /** Step list. Defaults to the registry; injected in tests. */
  steps?: readonly TourStep[];
  /** The section the host is showing right now. */
  currentSection: SectionId;
  /**
   * Ask the host to switch sections. Omitted → a step in another section is
   * unreachable and gets skipped rather than stalling the tour.
   */
  onNavigateToSection?: (section: SectionId) => void;
  /**
   * Offer the tour on mount when it has neither been completed nor skipped
   * (#1123 — the web host passes true; see AppProviders).
   *
   * Default false so a host that mounts the Provider for its `restart` alone
   * does not start walking sections behind the user's back. An offered run
   * that turns out to have nothing to show puts the user back where it found
   * them (see `originSectionRef`), so turning it on before the section Issues
   * have added their anchors costs a few frames and nothing else.
   */
  autoStart?: boolean;
  /**
   * How long a step waits for its anchor before being skipped. Defaults to
   * TOUR_ANCHOR_TIMEOUT_MS, which is sized for a code-split section body
   * arriving over the network; tests shorten it so a skip is not a real wait.
   */
  anchorTimeoutMs?: number;
  children: ReactNode;
}

export function TourProvider({
  steps = TOUR_STEPS,
  currentSection,
  onNavigateToSection,
  autoStart = false,
  anchorTimeoutMs = TOUR_ANCHOR_TIMEOUT_MS,
  children,
}: TourProviderProps) {
  const stepIds = useMemo(() => steps.map((s) => s.id), [steps]);
  const { progress, setProgress } = useTourProgress(stepIds);

  const [index, setIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  /**
   * The narrowed list a section run walks, or null for the whole tour (#1194).
   * State rather than a ref because `totalSteps` is derived from it and the
   * bubble's "3 / 4" has to re-render when it changes.
   */
  const [runSteps, setRunSteps] = useState<readonly TourStep[] | null>(null);
  /**
   * Bumped by every explicit start (#1194). The probe effect keys on
   * primitives, and starting the SAME position twice changes none of them —
   * pick Materials while a Materials run is already sitting at its first step
   * and index, isRunning and the step ids all match, so the effect would not
   * re-run and the bubble `setAnchorElement(null)` just cleared would never
   * come back. This is the one dep that always changes.
   */
  const [runId, setRunId] = useState(0);

  /** The list THIS RUN is walking — the registry, or one section of it. */
  const activeSteps = runSteps ?? steps;

  /*
   * Refs for everything the probe effect reads but must not RESTART for.
   * `steps` and `onNavigateToSection` are array/function literals at most call
   * sites, so a fresh identity arrives on every render; keeping them in deps
   * would reset the frame counter each render and the probe would never time
   * out. The effect keys on primitives instead (see its dep list).
   */
  const stepsRef = useRef(activeSteps);
  /** The FULL list, which `start` / `restart` / `startSection` select from —
   *  `stepsRef` may be holding one section's slice of it. */
  const allStepsRef = useRef(steps);
  const navigateRef = useRef(onNavigateToSection);
  const progressRef = useRef(progress);
  /** Has any step actually been displayed since `start()`? */
  const shownAnyRef = useRef(false);
  /** id of the step currently ON SCREEN, so leaving its section is
   *  distinguishable from never having reached it. */
  const shownStepIdRef = useRef<string | null>(null);
  const currentSectionRef = useRef(currentSection);
  /*
   * Where the user was standing when this run began, and whether the tour has
   * moved them since. Together they undo a run that showed NOTHING (#1123).
   *
   * The probe navigates BEFORE it knows whether the step is displayable —
   * it has to, since the anchor cannot exist until its section is mounted. So
   * a tour with no reachable anchors walks the user across every section in
   * its list and leaves them in the last one, and the host writes each of
   * those to `life-editor-last-section` on the way (useShellNavigation), which
   * makes the detour the place the app opens NEXT time too. Harmless while the
   * tour was opened on purpose from Settings — the user asked for it — but the
   * auto-start below offers it unprompted on first run, and an offer that
   * silently relocates the user is worse than no offer.
   */
  const originSectionRef = useRef<SectionId | null>(null);
  const navigatedRef = useRef(false);
  /**
   * This run began at a STORED position rather than at the top — the one case
   * where giving up walks backward instead of forward (#1193, see the header).
   */
  const resumedRef = useRef(false);
  /**
   * This run walks one section only, so it may write nothing but its own
   * bookmark (#1194 / #1359 — see the header). Checked inside `persist`,
   * which every write goes through.
   */
  const partialRef = useRef(false);

  // Synced in an effect, not during render (react-hooks/refs — the same shape
  // NoteDetailPanel's onCommitRef uses). `useRef(x)` seeds each one correctly
  // on the first render, so no consumer ever sees a stale value: effects run
  // before any handler can fire, and the probe effect below is declared after
  // this one, so it reads the current commit's values.
  useEffect(() => {
    stepsRef.current = activeSteps;
    allStepsRef.current = steps;
    navigateRef.current = onNavigateToSection;
    progressRef.current = progress;
    currentSectionRef.current = currentSection;
  });

  /*
   * Identity of the list the RUN is walking, for the probe effect's deps. Not
   * `stepIds`: those name the whole registry and would not change when a
   * section run narrows the list under a probe that is already waiting.
   */
  const activeKey = activeSteps.map((s) => s.id).join(" ");

  const persist = useCallback(
    (patch: Partial<TourProgress>) => {
      // A section run is a replay, not progress through the tour (#1194), so
      // the three fields that decide whether the tour is ever offered again
      // are sealed. Its own bookmark is the one thing it may leave (#1359).
      //
      // Still ONE guard, not a rule callers have to remember: a caller that
      // forgets the distinction and sends the whole patch has the dangerous
      // half dropped here rather than landing it.
      if (partialRef.current) {
        if (patch.sectionStepId === undefined) return;
        setProgress({
          ...progressRef.current,
          sectionStepId: patch.sectionStepId,
        });
        return;
      }
      setProgress({ ...progressRef.current, ...patch });
    },
    [setProgress],
  );

  /**
   * Move to `nextIndex`, or finish when it runs off the end.
   *
   * `reason` decides whether the RESUME POINT moves. "walked" means the user
   * left a step they were actually shown; "gaveUp" means the probe could not
   * display it. Only the first may be recorded — writing the resume point on a
   * give-up walks the stored position forward through steps nobody saw, and in
   * the state this app is in today (no `data-tour-id` anywhere yet) that walks
   * it straight to the LAST step, so the tour would come back showing "2 / 2"
   * the moment the first anchor lands. That is the exact opposite of the
   * "still waiting" invariant this file promises.
   */
  const goTo = useCallback(
    (nextIndex: number, reason: "walked" | "gaveUp") => {
      const list = stepsRef.current;
      shownStepIdRef.current = null;
      if (nextIndex < list.length) {
        setAnchorElement(null);
        setIndex(nextIndex);
        if (reason === "walked") persist({ stepId: list[nextIndex].id });
        return;
      }
      setAnchorElement(null);
      setIsRunning(false);
      setIndex(0);
      if (partialRef.current) {
        // A replay that reached its own end has spent its bookmark (#1359).
        // Without this the next pick of that section would land on its last
        // step and end immediately, which reads as the launcher being broken.
        persist({ sectionStepId: null });
      } else if (shownAnyRef.current) {
        persist({ stepId: null, completed: true, skipped: false });
      } else {
        // Nothing was ever displayable. The resume point was never moved (see
        // `reason`), so the tour is still waiting where it was — and the
        // sections the probe walked through on the way were never SHOWN to
        // anyone, so put the user back where the run found them.
        const back = originSectionRef.current;
        if (
          navigatedRef.current &&
          back &&
          back !== currentSectionRef.current
        ) {
          navigateRef.current?.(back);
        }
      }
      originSectionRef.current = null;
      navigatedRef.current = false;
      partialRef.current = false;
      setRunSteps(null);
    },
    [persist],
  );

  const start = useCallback(() => {
    const list = allStepsRef.current;
    if (isRunning || list.length === 0) return;
    partialRef.current = false;
    setRunSteps(null);
    setRunId((n) => n + 1);
    const resumeAt = list.findIndex((s) => s.id === progressRef.current.stepId);
    // `> 0`, not `>= 0`: resuming AT the first step is indistinguishable from
    // starting fresh, and there is nothing behind it to walk back to.
    resumedRef.current = resumeAt > 0;
    shownAnyRef.current = false;
    shownStepIdRef.current = null;
    originSectionRef.current = currentSectionRef.current;
    navigatedRef.current = false;
    setAnchorElement(null);
    setIndex(resumeAt >= 0 ? resumeAt : 0);
    setIsRunning(true);
    // Starting on purpose overrides an earlier dismissal — otherwise "Show me
    // the tour again" from Settings would open and immediately be ignored.
    if (progressRef.current.skipped) persist({ skipped: false });
  }, [isRunning, persist]);

  const restart = useCallback(() => {
    partialRef.current = false;
    setRunSteps(null);
    setRunId((n) => n + 1);
    resumedRef.current = false;
    shownAnyRef.current = false;
    shownStepIdRef.current = null;
    originSectionRef.current = currentSectionRef.current;
    navigatedRef.current = false;
    setAnchorElement(null);
    setIndex(0);
    setIsRunning(allStepsRef.current.length > 0);
    // The one door that IS the whole tour, so it clears every position —
    // including a section replay's, which "run it all again from the
    // beginning" plainly supersedes.
    setProgress({
      stepId: null,
      completed: false,
      skipped: false,
      sectionStepId: null,
    });
  }, [setProgress]);

  /*
   * Walk one section, from where it was left (#1194, #1359).
   *
   * Unconditional, unlike `start`: this is an explicit pick from the Settings
   * launcher, so a tour that happens to be up is REPLACED rather than left in
   * place ignoring the click.
   *
   * `originSectionRef` is left null on purpose. Its job is to undo a detour the
   * probe took through sections nobody asked to see; here the section IS what
   * was asked for, so landing there with nothing to show is still the right
   * place to be left — bouncing the user back to Settings would read as the
   * click having failed.
   *
   * A RESUMED replay sets `resumedRef` exactly as `start` does, and it has to.
   * Backward give-up (#1193) is what makes a stored position survivable: the
   * later steps of a section are precisely the ones assuming what the earlier
   * ones set up — a note is selected, the todo tab is open — and a reload
   * destroys that. Walking FORWARD from the stored step then meets the same
   * class of missing anchor every time and the replay ends having shown
   * nothing, which reads as the launcher click doing nothing at all. Walking
   * back lands on the section's first step, whose anchor stands on its own,
   * and asking the user to make a note again is what puts the later anchors
   * back in the document. There is always somewhere to walk back to, because
   * `resumeAt > 0` below is the only way this is set.
   */
  const startSection = useCallback((section: SectionId) => {
    const list = allStepsRef.current.filter((s) => s.section === section);
    if (list.length === 0) return;
    // `> 0` for the same reason `start` uses it: resuming AT the first step is
    // indistinguishable from starting fresh. A bookmark from ANOTHER section
    // is simply not in this list, so `findIndex` misses and we start at the
    // top — one slot, last replay wins, which is also why walking any replay
    // to its end clears the slot rather than only its own section's entry.
    const resumeAt = list.findIndex(
      (s) => s.id === progressRef.current.sectionStepId,
    );
    partialRef.current = true;
    resumedRef.current = resumeAt > 0;
    shownAnyRef.current = false;
    shownStepIdRef.current = null;
    originSectionRef.current = null;
    navigatedRef.current = false;
    setAnchorElement(null);
    setRunSteps(list);
    setRunId((n) => n + 1);
    setIndex(resumeAt > 0 ? resumeAt : 0);
    setIsRunning(true);
  }, []);

  /**
   * Give up on the step at `from`, in whichever direction can still land
   * (#1193 — the header explains why the direction is not always forward).
   *
   * Backward only while a resumed run has shown NOTHING. Both halves of that
   * condition are load-bearing: a fresh run scanning from step 0 must be
   * allowed to walk past steps whose sections have no anchors yet, which is
   * the fallback #1122 built the probe around; and once a step HAS been shown,
   * a later missing anchor is an ordinary skip (`materials-tag-follow` only
   * renders with two tag groups) and must not send the user back through
   * steps they just finished.
   *
   * Running out of earlier steps ends the run rather than turning around. The
   * end branch of `goTo` is what handles that correctly — with nothing shown
   * it writes no `completed` and puts the user back where the run found them.
   */
  const giveUp = useCallback(
    (from: number) => {
      if (resumedRef.current && !shownAnyRef.current) {
        goTo(from > 0 ? from - 1 : stepsRef.current.length, "gaveUp");
        return;
      }
      goTo(from + 1, "gaveUp");
    },
    [goTo],
  );

  const next = useCallback(() => {
    if (!isRunning) return;
    goTo(index + 1, "walked");
  }, [goTo, index, isRunning]);

  /**
   * Put the tour away at the current step, recording where it stood.
   *
   * The two run kinds record it in different places, and the branch has to
   * run BEFORE `partialRef` is cleared below — that ordering is what #1359
   * was: the write happened, `persist` swallowed it, and the section replay
   * came back at the top every time.
   *
   * A replay's `skipped` splits the two meanings `stopAt` otherwise conflates.
   * Escape is "not now", so it leaves the bookmark; Skip is "done with this
   * bit", so it clears it and the next pick starts at the top. Neither may
   * touch the tour-wide `skipped` flag — that answers "may the tour offer
   * itself unprompted", and a replay is not an answer to it.
   */
  const stopAt = useCallback(
    (skipped: boolean) => {
      const step = stepsRef.current[index];
      shownStepIdRef.current = null;
      setAnchorElement(null);
      setIsRunning(false);
      if (partialRef.current) {
        persist({ sectionStepId: skipped ? null : (step?.id ?? null) });
      } else {
        persist({ stepId: step?.id ?? null, skipped });
      }
      partialRef.current = false;
      setRunSteps(null);
    },
    [index, persist],
  );

  const skip = useCallback(() => stopAt(true), [stopAt]);
  const pause = useCallback(() => stopAt(false), [stopAt]);

  const notifyAction = useCallback(
    (event: string) => {
      if (!isRunning) return;
      const step = stepsRef.current[index];
      if (!step) return;
      if (step.advanceOn.kind !== "action" || step.advanceOn.event !== event) {
        return;
      }
      goTo(index + 1, "walked");
    },
    [goTo, index, isRunning],
  );

  /*
   * Resolve the current step's anchor, or give up on it.
   *
   * Deps are primitives on purpose (see the refs above). `currentSection` is
   * among them so arriving in the right section restarts the wait with a fresh
   * deadline rather than racing the time already spent getting there.
   *
   * The deadline is WALL CLOCK, not a frame count. A frame budget looks
   * equivalent and is not: `currentSection` flips the moment the section state
   * updates, which is when the `<Suspense>` fallback renders — not when the
   * lazily-imported section body arrives (Notes / Analytics / Connect are all
   * code-split, web/src/lazySections.ts). A couple hundred milliseconds of
   * frames is spent against the fallback, and every step anchored in a lazy
   * section would be silently skipped on a cold load.
   */
  useEffect(() => {
    if (!isRunning) return;
    const list = stepsRef.current;
    const step = list[index];
    // An index past the end is the end — treating it as a no-op would leave
    // the tour running with nothing on screen and no way out but skip/pause.
    if (!step) {
      goTo(list.length, "gaveUp");
      return;
    }

    if (step.section !== currentSection) {
      if (shownStepIdRef.current === step.id) {
        // The user navigated away from a step they were being SHOWN. That is
        // their choice, so put the tour away here instead of yanking them
        // back — re-navigating would make the section they picked unreachable
        // for as long as the tour is up.
        pause();
        return;
      }
      const navigate = navigateRef.current;
      if (!navigate) {
        // No way to reach this step's section. Giving up keeps the rest of the
        // tour walkable instead of stalling on a section we cannot open.
        giveUp(index);
        return;
      }
      navigate(step.section);
      navigatedRef.current = true;
    }

    const deadline = now() + anchorTimeoutMs;
    let raf = 0;
    const probe = () => {
      if (step.section === currentSection) {
        const el = resolveTourStepAnchor(step);
        if (el) {
          shownAnyRef.current = true;
          shownStepIdRef.current = step.id;
          setAnchorElement(el);
          return;
        }
      }
      if (now() < deadline) {
        raf = requestAnimationFrame(probe);
        return;
      }
      giveUp(index);
    };
    probe();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [
    anchorTimeoutMs,
    currentSection,
    giveUp,
    goTo,
    index,
    isRunning,
    pause,
    activeKey,
    runId,
  ]);

  /*
   * Offer the tour once per mount, when the host asked for it (#1123).
   *
   * The two end states are read from `progress`, which `useLocalStorage` seeds
   * SYNCHRONOUSLY in its `useState` initialiser — so "skipped" is already
   * known on the very first render and a dismissed tour never flashes back on
   * a reload. Reading it from an effect instead would auto-start first and
   * learn about the dismissal after.
   *
   * `autoStartedRef` makes it once per MOUNT rather than once per session:
   * `restart()` from Settings clears both flags, and without the latch this
   * effect would re-fire on that state change and start a second run over the
   * top of the one the user just asked for.
   */
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    if (progress.completed || progress.skipped) return;
    if (steps.length === 0) return;
    autoStartedRef.current = true;
    start();
  }, [autoStart, progress.completed, progress.skipped, start, steps.length]);

  const activeStep =
    isRunning && anchorElement ? (activeSteps[index] ?? null) : null;

  const value = useMemo(
    (): TourContextValue => ({
      activeStep,
      anchorElement: activeStep ? anchorElement : null,
      stepNumber: activeStep ? index + 1 : 0,
      totalSteps: activeSteps.length,
      isRunning,
      isComplete: progress.completed,
      isSkipped: progress.skipped,
      start,
      next,
      skip,
      pause,
      restart,
      startSection,
      notifyAction,
    }),
    [
      activeStep,
      activeSteps.length,
      anchorElement,
      index,
      isRunning,
      next,
      notifyAction,
      pause,
      progress.completed,
      progress.skipped,
      restart,
      skip,
      start,
      startSection,
    ],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
