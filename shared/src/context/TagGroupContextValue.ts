import { createContext } from "react";
import type { useTagGroupsAPI } from "../hooks/useTagGroupsAPI";

export type TagGroupContextValue = ReturnType<typeof useTagGroupsAPI>;

export const TagGroupContext = createContext<TagGroupContextValue | null>(null);
