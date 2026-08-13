import { useTimerContext } from "../hooks/useTimerContext";

/*
 * Live timer line for the Work nav row (#550). Like AudioChimeBridge this is
 * a context bridge, not a pure primitive: it reads TimerContext directly, so
 * it MUST be rendered inside a TimerProvider — the host injects it as the
 * Work section's `sublabel`, and because the sidebar sits inside the global
 * Provider layer the countdown stays live whichever section is open. Renders
 * nothing while the timer is idle, which is what keeps the resting nav
 * identical to the no-timer shell. Copy-free: the countdown is numeric and
 * the todo title is user data, so there is nothing to translate.
 */
export function NavTimerStatus() {
  const { isRunning, formatted, activeTodo } = useTimerContext();
  if (!isRunning) return null;
  return (
    <>
      <span className="tabular-nums">{formatted}</span>
      {activeTodo != null && ` · ${activeTodo.title}`}
    </>
  );
}
