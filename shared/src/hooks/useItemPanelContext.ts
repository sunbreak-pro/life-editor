import { ItemPanelContext } from "../context/ItemPanelContextValue";
import { createContextHook } from "./createContextHook";
import { createOptionalContextHook } from "./createOptionalContextHook";

/** Pattern A 3/3 (#2218). Throws outside ItemPanelProvider. */
export const useItemPanelContext = createContextHook(
  ItemPanelContext,
  "useItemPanelContext",
);

/**
 * Null outside the Provider — for a caller that may render in a standalone
 * tree (tests, a host without the global chain) and can fall back to
 * navigating instead.
 */
export const useItemPanelOptional = createOptionalContextHook(ItemPanelContext);
