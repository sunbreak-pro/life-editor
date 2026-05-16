export type SidebarLinkKind = "url" | "app";

export interface SidebarLink {
  id: string;
  kind: SidebarLinkKind;
  name: string;
  target: string;
  emoji: string | null;
  sortOrder: number;
  isDeleted: boolean;
  deletedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface BrowserInfo {
  id: string;
  name: string;
  path: string;
}

export interface InstalledApp {
  name: string;
  path: string;
}

export interface SidebarLinkUpdate {
  name?: string;
  target?: string;
  kind?: SidebarLinkKind;
  emoji?: string | null;
  sortOrder?: number;
}
