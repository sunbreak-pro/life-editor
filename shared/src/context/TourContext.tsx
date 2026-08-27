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
   * Begin on mount when the tour has neither been completed nor skipped.
   * Default false: the anchors ship with the section Issues, so the host turns
   * this on once there is something to point at.
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

  // Synced in an effect, not during render (react-hooks/refs — the same shape
  // NoteDetailPanel's onCommitRef uses). `useRef(x)` seeds each one correctly
  // on the first render, so no consumer ever sees a stale value: effects run
  // before any handler can fire, and the probe effect below is declared after
  // this one, so it reads the current commit's values.
  useEffect(() => {
    stepsRef.current = steps;
    navigateRef.current = onNavigateToSection;
    progressRef.current = progress;
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
      }
      // else: nothing was ever displayable. The resume point was never moved
      // (see `reason`), so the tour is still waiting where it was.
    },
    [persist],
  );

  const start = useCallback(() => {
    const list = stepsRef.current;
    if (isRunning || list.length === 0) return;
    const resumeAt = list.findIndex((s) => s.id === progressRef.current.stepId);
    shownAnyRef.current = false;
    shownStepIdRef.current = null;
    setAnchorElement(null);
    setIndex(resumeAt >= 0 ? resumeAt : 0);
    setIsRunning(true);
    // Starting on purpose overrides an earlier dismissal — otherwise "Show me
    // the tour again" from Settings would open and immediately be ignored.
    if (progressRef.current.skipped) persist({ skipped: false });
  }, [isRunning, persist]);

  const restart = useCallback(() => {
    shownAnyRef.current = false;
    shownStepIdRef.current = null;
    setAnchorElement(null);
    setIndex(0);
    setIsRunning(stepsRef.current.length > 0);
    setProgress({ stepId: null, completed: false, skipped: false });
  }, [setProgress]);

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
        // No way to reach this step's section. Skipping keeps the rest of the
        // tour walkable instead of stalling on a section we cannot open.
        goTo(index + 1, "gaveUp");
        return;
      }
      navigate(step.section);
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
      goTo(index + 1, "gaveUp");
    };
    probe();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [anchorTimeoutMs, currentSection, goTo, index, isRunning, pause, stepsKey]);

  /** Auto-start once per mount, when the host asked for it. */
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
