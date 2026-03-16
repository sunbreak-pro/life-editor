import type { LucideIcon } from "lucide-react";

export type FilterItemKind = "tag" | "entity-type" | "virtual-tag";

export interface FilterItem {
  id: string;
  kind: FilterItemKind;
  name: string;
  color?: string;
  textColor?: string;
  icon?: LucideIcon;
}

export const ENTITY_FILTER_NOTE_ID = "__entity:note";
export const ENTITY_FILTER_MEMO_ID = "__entity:memo";
export const VIRTUAL_UNTAGGED_ID = "__virtual:untagged";
