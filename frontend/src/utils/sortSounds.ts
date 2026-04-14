import type { SortDirection } from "../components/shared/SortDropdown";

export type SoundSortMode = "default" | "name" | "custom-first";

export interface SortableSound {
  id: string;
  label: string;
  isCustom: boolean;
}

export function sortSounds<T extends SortableSound>(
  sounds: T[],
  mode: SoundSortMode,
  getDisplayName: (id: string) => string | undefined,
  direction: SortDirection = "asc",
): T[] {
  if (mode === "default") return sounds;

  if (mode === "name") {
    const sorted = [...sounds].sort((a, b) => {
      const nameA = (getDisplayName(a.id) || a.label).toLowerCase();
      const nameB = (getDisplayName(b.id) || b.label).toLowerCase();
      return nameA.localeCompare(nameB);
    });
    if (direction === "desc") sorted.reverse();
    return sorted;
  }

  if (mode === "custom-first") {
    const custom = sounds.filter((s) => s.isCustom);
    const preset = sounds.filter((s) => !s.isCustom);
    const result = [...custom, ...preset];
    if (direction === "desc") result.reverse();
    return result;
  }

  return sounds;
}
