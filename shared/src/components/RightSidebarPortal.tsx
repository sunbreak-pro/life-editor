import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { useRightSidebarOptional } from "../hooks/useRightSidebarContext";

/*
 * RightSidebarPortal — the part a section body uses to push its detail UI into
 * the shared detail panel (App Shell Turn 2). Reads the context through the
 * OPTIONAL hook so a section that renders it without a Provider (existing tests
 * / standalone renders) simply gets null instead of throwing.
 *
 * While mounted it registers "content exists" (so the panel drops its empty
 * state) even when the panel is closed (portalTarget null → renders nothing but
 * stays counted). When the panel is open, its children render into the panel's
 * body via createPortal.
 */
export interface RightSidebarPortalProps {
  children: ReactNode;
}

export function RightSidebarPortal({ children }: RightSidebarPortalProps) {
  const ctx = useRightSidebarOptional();
  const registerContent = ctx?.registerContent;

  useEffect(() => {
    if (!registerContent) return;
    return registerContent();
  }, [registerContent]);

  if (!ctx || !ctx.portalTarget) return null;
  return createPortal(children, ctx.portalTarget);
}
