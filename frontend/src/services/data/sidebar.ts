import type { SidebarLink, SidebarLinkUpdate } from "../../types/sidebarLink";
import { tauriInvoke } from "../bridge";

export const sidebarApi = {
  fetchSidebarLinks(): Promise<SidebarLink[]> {
    return tauriInvoke("db_sidebar_links_fetch_all");
  },
  createSidebarLink(input: {
    id: string;
    kind: "url" | "app";
    name: string;
    target: string;
    emoji?: string | null;
  }): Promise<SidebarLink> {
    return tauriInvoke("db_sidebar_links_create", {
      id: input.id,
      kind: input.kind,
      name: input.name,
      target: input.target,
      emoji: input.emoji ?? null,
    });
  },
  updateSidebarLink(
    id: string,
    updates: SidebarLinkUpdate,
  ): Promise<SidebarLink> {
    return tauriInvoke("db_sidebar_links_update", { id, updates });
  },
  deleteSidebarLink(id: string): Promise<void> {
    return tauriInvoke("db_sidebar_links_delete", { id });
  },
  reorderSidebarLinks(ids: string[]): Promise<void> {
    return tauriInvoke("db_sidebar_links_reorder", { ids });
  },
};
