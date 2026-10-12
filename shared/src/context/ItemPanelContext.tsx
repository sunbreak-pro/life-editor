import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ItemPanelContext,
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

  const value = useMemo<ItemPanelContextValue>(
    () => ({ request, openEdit, openCreate, close }),
    [request, openEdit, openCreate, close],
  );
  return (
    <ItemPanelContext.Provider value={value}>
      {children}
    </ItemPanelContext.Provider>
  );
}
