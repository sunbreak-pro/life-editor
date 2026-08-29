import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  resolveTourAnchor,
  TOUR_ANCHOR_TIMEOUT_MS,
} from "../components/tour/anchor";
import { TOUR_STEPS } from "../components/tour/registry";
import { type TourStep } from "../components/tour/types";
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
   * them (see `startSectionRef`), so turning it on before the section Issues
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

  /*
   * Refs for everything the probe effect reads but must not RESTART for.
   * `steps` and `onNavigateToSection` are array/function literals at most call
   * sites, so a fresh identity arrives on every render; keeping them in deps
   * would reset the frame counter each render and the probe would never time
   * out. The effect keys on primitives instead (see its dep list).
   */
  const stepsRef = useRef(steps);
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
  const startSectionRef = useRef<SectionId | null>(null);
  const navigatedRef = useRef(false);
  /**
   * This run began at a STORED position rather than at the top — the one case
   * where giving up walks backward instead of forward (#1193, see the header).
   */
  const resumedRef = useRef(false);

  // Synced in an effect, not during render (react-hooks/refs — the same shape
  // NoteDetailPanel's onCommitRef uses). `useRef(x)` seeds each one correctly
  // on the first render, so no consumer ever sees a stale value: effects run
  // before any handler can fire, and the probe effect below is declared after
  // this one, so it reads the current commit's values.
  useEffect(() => {
    stepsRef.current = steps;
    navigateRef.current = onNavigateToSection;
    progressRef.current = progress;
    currentSectionRef.current = currentSection;
  });

  const stepsKey = stepIds.join(" ");

  const persist = useCallback(
    (
      patch: Partial<{
        stepId: string | null;
        completed: boolean;
        skipped: boolean;
      }>,
    ) => {
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
      if (shownAnyRef.current) {
        persist({ stepId: null, completed: true, skipped: false });
      } else {
        // Nothing was ever displayable. The resume point was never moved (see
        // `reason`), so the tour is still waiting where it was — and the
        // sections the probe walked through on the way were never SHOWN to
        // anyone, so put the user back where the run found them.
        const back = startSectionRef.current;
        if (
          navigatedRef.current &&
          back &&
          back !== currentSectionRef.current
        ) {
          navigateRef.current?.(back);
        }
      }
      startSectionRef.current = null;
      navigatedRef.current = false;
    },
    [persist],
  );

  const start = useCallback(() => {
    const list = stepsRef.current;
    if (isRunning || list.length === 0) return;
    const resumeAt = list.findIndex((s) => s.id === progressRef.current.stepId);
    // `> 0`, not `>= 0`: resuming AT the first step is indistinguishable from
    // starting fresh, and there is nothing behind it to walk back to.
    resumedRef.current = resumeAt > 0;
    shownAnyRef.current = false;
    shownStepIdRef.current = null;
    startSectionRef.current = currentSectionRef.current;
    navigatedRef.current = false;
    setAnchorElement(null);
    setIndex(resumeAt >= 0 ? resumeAt : 0);
    setIsRunning(true);
    // Starting on purpose overrides an earlier dismissal — otherwise "Show me
    // the tour again" from Settings would open and immediately be ignored.
    if (progressRef.current.skipped) persist({ skipped: false });
  }, [isRunning, persist]);

  const restart = useCallback(() => {
    resumedRef.current = false;
    shownAnyRef.current = false;
    shownStepIdRef.current = null;
    startSectionRef.current = currentSectionRef.current;
    navigatedRef.current = false;
    setAnchorElement(null);
    setIndex(0);
    setIsRunning(stepsRef.current.length > 0);
    setProgress({ stepId: null, completed: false, skipped: false });
  }, [setProgress]);

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

  const stopAt = useCallback(
    (skipped: boolean) => {
      const step = stepsRef.current[index];
      shownStepIdRef.current = null;
      setAnchorElement(null);
      setIsRunning(false);
      persist({ stepId: step?.id ?? null, skipped });
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
        const el = resolveTourAnchor(step.anchor);
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
    stepsKey,
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

  const activeStep = isRunning && anchorElement ? (steps[index] ?? null) : null;

  const value = useMemo(
    (): TourContextValue => ({
      activeStep,
      anchorElement: activeStep ? anchorElement : null,
      stepNumber: activeStep ? index + 1 : 0,
      totalSteps: steps.length,
      isRunning,
      isComplete: progress.completed,
      isSkipped: progress.skipped,
      start,
      next,
      skip,
      pause,
      restart,
      notifyAction,
    }),
    [
      activeStep,
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
      steps.length,
    ],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
