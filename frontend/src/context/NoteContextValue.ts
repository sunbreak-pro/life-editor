import { createContext } from "react";
import type { useNotes } from "../hooks/useNotes";

export type NoteContextValue = ReturnType<typeof useNotes>;

export const NoteContext = createContext<NoteContextValue | null>(null);
