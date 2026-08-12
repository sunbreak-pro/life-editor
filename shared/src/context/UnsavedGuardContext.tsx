import { useCallback, useMemo, useRef, type ReactNode } from "react";
import { ConfirmDialog, useConfirmDialog } from "../components/ConfirmDialog";
import {
  UnsavedGuardContext,
  type UnsavedGuardContextValue,
  type UnsavedProbe,
} from "./UnsavedGuardContextValue";

/*
 * UnsavedGuardProvider — Pattern A 2/3 (CLAUDE.md §6.3). See
 * UnsavedGuardContextValue for WHY the question is asked one level above the
 * content (#753).
 *
 * Host mounts this OUTSIDE everything that can be torn down — above the section
 * switch AND above RightSidebarProvider, which consults it before the sidebar
 * closes. Pure UI state, DataService-free (§3.1); copy is injected already
 * translated (§6.4).
 *
 * The probes live in a ref, not state: registering one must not re-render the
 * whole shell (a panel registers on mount and deregisters on unmount, and
 * nothing on screen depends on the count), and `confirmDiscard` has to see the
 * set as it is at the moment it is asked — not as it was when the callback that
 * asked was created.
 */

export interface UnsavedGuardLabels {
  /** Already-translated question, e.g. "破棄しますか?" (§6.4). */
  message: string;
  /** Already-translated affirmative ("破棄"). */
  discard: string;
  /** Already-translated refusal ("キャンセル"). */
  cancel: string;
}

export interface UnsavedGuardProviderProps {
  labels: UnsavedGuardLabels;
  children: ReactNode;
}

export function UnsavedGuardProvider({
  labels,
  children,
}: UnsavedGuardProviderProps) {
  const probesRef = useRef<Set<UnsavedProbe>>(new Set());
  const { request, ask, resolve } = useConfirmDialog();
  const { message, discard, cancel } = labels;

  const registerUnsaved = useCallback((probe: UnsavedProbe) => {
    probesRef.current.add(probe);
    return () => {
      probesRef.current.delete(probe);
    };
  }, []);

  const confirmDiscard = useCallback(async () => {
    // Asked LIVE. One probe answering yes is enough — the user is not told
    // WHICH panel is holding work, because on any given screen there is at most
    // one draft surface open and naming it would need copy per host.
    let pending = false;
    for (const probe of probesRef.current) {
      if (probe()) {
        pending = true;
        break;
      }
    }
    // Nothing to lose: go straight through. Asking here is what teaches the
    // user to dismiss the dialog unread, and then the real one is useless too.
    if (!pending) return true;
    return ask({
      message,
      confirmLabel: discard,
      cancelLabel: cancel,
      // Throwing away typed-in work is the destructive answer, even though
      // nothing is deleted from the database.
      danger: true,
    });
  }, [ask, message, discard, cancel]);

  const value = useMemo<UnsavedGuardContextValue>(
    () => ({ registerUnsaved, confirmDiscard }),
    [registerUnsaved, confirmDiscard],
  );

  return (
    <UnsavedGuardContext.Provider value={value}>
      {children}
      {/* Mounted by the Provider, not by the content: the panel being asked
          about is the thing that is about to disappear, so a dialog it owned
          would go with it. It holds no place in the tree while nothing is
          being asked (#707). */}
      {request && (
        <ConfirmDialog
          open
          message={request.message}
          confirmLabel={request.confirmLabel}
          cancelLabel={request.cancelLabel}
          danger={request.danger}
          onConfirm={() => resolve(true)}
          onCancel={() => resolve(false)}
        />
      )}
    </UnsavedGuardContext.Provider>
  );
}
