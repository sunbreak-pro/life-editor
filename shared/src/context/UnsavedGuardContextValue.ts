import { createContext } from "react";

/*
 * UnsavedGuard (#753) — Pattern A 1/3 (CLAUDE.md §6.3).
 *
 * Since the save button became the only commit (D-20260810-sched-1), anything
 * that TEARS A PANEL DOWN throws its draft away. #736 covered the exits a panel
 * can see — its own close button, Escape, the backdrop — but not the ones that
 * remove the panel's whole container: closing the right sidebar (the portal
 * target goes null and the children unmount with it) and switching sections.
 * From inside the panel those look like nothing at all; there is no event to
 * hook, only an unmount that has already happened.
 *
 * So the question is asked one level up. Content REGISTERS a probe ("do I hold
 * a draft right now?") and containers ASK before they tear it down.
 *
 * Two properties this shape is built for:
 *
 *   - the probe is called live, every time. A cached boolean would go stale the
 *     instant the panel re-reported (this is why PR #745's hosts could not
 *     apply `decision.clearDirty`: the panel re-reports `false` as it unmounts,
 *     so a flag cleared up here could only ever be wrong). Nothing is cached,
 *     so a REFUSED discard leaves the draft pending and the next attempt asks
 *     again — exactly what #736's own tests pin one level down.
 *   - the dialog belongs to the Provider, not to the content. A question the
 *     disappearing panel owns would disappear with it.
 */

/** Does this piece of content hold work that a teardown would throw away? */
export type UnsavedProbe = () => boolean;

export interface UnsavedGuardContextValue {
  /**
   * Register a probe for as long as the content is mounted. Returns the
   * cleanup that deregisters it (mount = +1 / unmount = −1, like
   * RightSidebar's `registerContent`).
   */
  registerUnsaved: (probe: UnsavedProbe) => () => void;
  /**
   * Ask before tearing content down. Resolves `true` when the caller may go
   * ahead — nothing is pending, or the user agreed to discard it.
   *
   * Awaited, because the question is the in-app <ConfirmDialog> (#707) and its
   * answer arrives a tick later. A caller that read the pending promise as a
   * truthy "yes" would discard the draft the moment the dialog opened.
   */
  confirmDiscard: () => Promise<boolean>;
}

export const UnsavedGuardContext =
  createContext<UnsavedGuardContextValue | null>(null);
