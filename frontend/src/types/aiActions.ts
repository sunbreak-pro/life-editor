import type { SectionId } from "./taskTree";

export interface AIAction {
  id: string;
  labelKey: string;
  icon: string;
  promptTemplate: string;
  sections: SectionId[] | "global";
  ideasTab?: string;
  contextRequired?: "note" | "memo";
}
