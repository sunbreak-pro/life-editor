import { createContext, useContext } from "react";

export interface TagGraphSelectionValue {
  selectedTagId: string | null;
  relatedNodeIds: Set<string> | null;
}

const EMPTY: TagGraphSelectionValue = {
  selectedTagId: null,
  relatedNodeIds: null,
};

export const TagGraphSelectionContext =
  createContext<TagGraphSelectionValue>(EMPTY);

export function useTagGraphSelection(): TagGraphSelectionValue {
  return useContext(TagGraphSelectionContext);
}
