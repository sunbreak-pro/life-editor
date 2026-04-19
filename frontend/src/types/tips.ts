import type { LucideIcon } from "lucide-react";
import type { SectionId } from "./taskTree";

export interface TipDefinition {
  id: string;
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
  docsPath?: string;
}

export interface TipsTabDefinition {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  tips: TipDefinition[];
}

export type TipsSectionId = Extract<
  SectionId,
  "schedule" | "work" | "materials" | "connect" | "terminal" | "analytics"
>;

export type SectionTipsMap = Record<TipsSectionId, TipsTabDefinition[]>;
