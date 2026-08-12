import { useEffect, useRef } from "react";
import { createOptionalContextHook } from "./createOptionalContextHook";
import { UnsavedGuardContext } from "../context/UnsavedGuardContextValue";

/*
 * UnsavedGuard hooks — Pattern A 3/3 (CLAUDE.md §6.3), #753.
 *
 * Optional-only, deliberately: both sides of this contract are opt-in. A
 * section body that holds a draft may be rendered by a host with no Provider
 * (every existing test, and the standalone renders), and the containers that
 * ask — the right sidebar, the section switch — must keep working there too.
 * Returning null rather than throwing is the coding-principles §4 shape.
 */
export const useUnsavedGuardOptional =
  createOptionalContextHook(UnsavedGuardContext);

/**
 * Declare that this component holds work a teardown would throw away.
 *
 * `hasUnsavedDraft` is called at the moment someone asks, not at render time,
 * so the caller normally hands in a function that reads a ref — the same
 * pending-draft flag the panel's own close guard reads (#736). No-ops outside a
 * Provider.
 */
export function useUnsavedDraft(hasUnsavedDraft: () => boolean): void {
  const guard = useUnsavedGuardOptional();
  // The probe is registered ONCE per Provider, not once per render: it is read
  // through this ref so a fresh inline closure each render does not churn the
  // registration (and, worse, leave a window with nothing registered).
  const latest = useRef(hasUnsavedDraft);
  useEffect(() => {
    latest.current = hasUnsavedDraft;
  }, [hasUnsavedDraft]);
  useEffect(() => {
    if (!guard) return;
    return guard.registerUnsaved(() => latest.current());
  }, [guard]);
}
