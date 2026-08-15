import type { ReactNode } from "react";
import {
  TimerProvider,
  useAudioContext,
  useTranslation,
  type DataService,
} from "@life-editor/shared";

/*
 * TimerProvider host, mounted INSIDE AudioProvider (#676 (c)).
 *
 * The Pomodoro's `onSessionComplete` rings the completion chime, which the
 * Audio Provider owns — so Timer depends on Audio, and by the Provider-order
 * invariant (rules/frontend.md §Provider 順序: an inner Provider may read an
 * outer Context, never the reverse) Audio has to be the OUTER one.
 *
 * It used to be the other way round, with a ref bridging the gap backwards:
 * the host kept a `chimeRef`, handed the Timer `() => chimeRef.current?.()`,
 * and mounted a headless AudioChimeBridge inside the Audio Provider to publish
 * the live `playCompletionChime` into that ref. That is three moving parts to
 * carry one function up one level of nesting, and it made the chime silently
 * dependent on mount ORDER — a phase that ended before the bridge's effect had
 * run rang nothing. Swapping the two Providers deletes the whole mechanism:
 * this component just reads the chime and hands it over.
 *
 * Renders as a Provider, so it lives here in the host rather than in shared —
 * same shape as UndoRedoHost and ShortcutConfigHost. `useAudioContext` is the
 * OPTIONAL variant (coding-principles §4): outside an Audio Provider it is
 * null and the Timer simply completes phases without a sound.
 */
export function TimerHost({
  dataService,
  children,
}: {
  dataService: DataService;
  children: ReactNode;
}) {
  const audio = useAudioContext();
  const { t } = useTranslation();
  return (
    <TimerProvider
      dataService={dataService}
      // #882 — the title of the Todo minted for an unattributed WORK phase.
      // Resolved here because the Provider lives in shared, which never calls
      // useTranslation itself (rules/frontend.md).
      untitledTodoTitle={t("work.todoSelector.untitled")}
      onSessionComplete={audio?.playCompletionChime}
    >
      {children}
    </TimerProvider>
  );
}
