import { NoteContext } from "../context/NoteContextValue";
import { createContextHook } from "./createContextHook";

export const useNoteContext = createContextHook(NoteContext, "useNoteContext");
