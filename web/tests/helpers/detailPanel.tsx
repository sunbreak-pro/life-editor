import { createElement, type ReactNode } from "react";
import {
  RightSidebarContext,
  type RightSidebarContextValue,
} from "@life-editor/shared";

/*
 * An open detail panel for a host under test (#2285) — what the shell's
 * RightSidebar gives a screen: a portal target in the document, already open.
 * Briefing's carryover, remaining-todo and upcoming blocks render through
 * <RightSidebarPortal>, which draws nothing without one.
 *
 * The target is appended to document.body, so `screen` queries reach it;
 * `remove` takes it back out.
 */
export function createDetailPanel(): {
  panelBody: HTMLElement;
  wrap: (children: ReactNode) => ReturnType<typeof createElement>;
  remove: () => void;
} {
  const panelBody = document.createElement("div");
  panelBody.setAttribute("data-testid", "panel-body");
  document.body.appendChild(panelBody);
  const value: RightSidebarContextValue = {
    isOpen: true,
    open: () => undefined,
    close: () => undefined,
    requestClose: () => undefined,
    toggle: () => undefined,
    width: 320,
    setWidth: () => undefined,
    portalTarget: panelBody,
    setPortalTarget: () => undefined,
    contentCount: 0,
    registerContent: () => () => undefined,
  };
  return {
    panelBody,
    wrap: (children) =>
      createElement(RightSidebarContext.Provider, { value }, children),
    remove: () => panelBody.remove(),
  };
}
