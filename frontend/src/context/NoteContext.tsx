import type { ReactNode } from "react";
import { useNotes } from "../hooks/useNotes";
import { NoteContext } from "./NoteContextValue";

export function NoteProvider({ children }: { children: ReactNode }) {
  const noteState = useNotes();
  return (
    <NoteContext.Provider value={noteState}>{children}</NoteContext.Provider>
  );
}
