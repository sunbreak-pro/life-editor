import type { SectionId } from "../../../types/taskTree";
import type { UndoDomain } from "../../../utils/undoRedo/types";

export const SECTION_UNDO_DOMAINS: Partial<Record<SectionId, UndoDomain[]>> = {
  schedule: ["scheduleItem", "routine", "taskTree", "calendar"],
  materials: ["daily", "note", "wikiTag"],
  connect: ["wikiTag"],
  work: ["playlist", "sound"],
  settings: ["settings"],
};

const MOBILE_OMITTED_DOMAINS: UndoDomain[] = ["playlist", "sound", "settings"];

export function getMobileUndoDomains(section: SectionId): UndoDomain[] {
  const desktop = SECTION_UNDO_DOMAINS[section] ?? [];
  return desktop.filter((d) => !MOBILE_OMITTED_DOMAINS.includes(d));
}
