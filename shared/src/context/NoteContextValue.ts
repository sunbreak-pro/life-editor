import { createContext } from "react";
import type { useNotesAPI } from "../hooks/useNotesAPI";

export type NoteContextValue = ReturnType<typeof useNotesAPI>;

export const NoteContext = createContext<NoteContextValue | null>(null);
