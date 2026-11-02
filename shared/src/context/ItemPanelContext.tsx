import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ItemPanelContext,
  type ItemPanelCloseGuard,
  type ItemPanelContextValue,
  type ItemPanelCreateInitial,
  type ItemPanelEditTarget,
  type ItemPanelOptions,
  type ItemPanelRequest,
} from "./ItemPanelContextValue";

/*
 * ItemPanel Provider — Pattern A 2/3 (#2218).
 *
 * GLOBAL layer, not section layer: the callers are other sections (Briefing,
 * Connect), and the request has to outlive nothing but itself. It holds one
 * request at a time — a second open replaces the first, which is what a
 * second click on another row means.
 */
export interface ItemPanelProviderProps {
  children: ReactNode;
}

export function ItemPanelProvider({ children }: ItemPanelProviderProps) {
  const [request, setRequest] = useState<ItemPanelRequest | null>(null);
  const seq = useRef(0);

  const openEdit = useCallback(
    (target: ItemPanelEditTarget, options: ItemPanelOptions = {}) => {
      setRequest({ mode: "edit", target, options, seq: ++seq.current });
    },
    [],
  );
  const openCreate = useCallback(
    (initial: ItemPanelCreateInitial, options: ItemPanelOptions = {}) => {
      setRequest({ mode: "create", initial, options, seq: ++seq.current });
    },
    [],
  );
  const close = useCallback(() => setRequest(null), []);

  // A ref: the guard closes over the panel's draft and changes with its host's
  // renders, and nothing on screen reads it.
  const closeGuard = useRef<ItemPanelCloseGuard | null>(null);
  const registerCloseGuard = useCallback(
    (guard: ItemPanelCloseGuard | null) => {
      closeGuard.current = guard;
    },
    [],
  );
  const requestClose = useCallback<ItemPanelCloseGuard>((then) => {
    if (closeGuard.current) {
      closeGuard.current(then);
      return;
    }
    setRequest(null);
    then?.();
  }, []);

  const value = useMemo<ItemPanelContextValue>(
    () => ({
      request,
      openEdit,
      openCreate,
      close,
      requestClose,
      registerCloseGuard,
    }),
    [request, openEdit, openCreate, close, requestClose, registerCloseGuard],
  );
  return (
    <ItemPanelContext.Provider value={value}>
      {children}
    </ItemPanelContext.Provider>
  );
}
