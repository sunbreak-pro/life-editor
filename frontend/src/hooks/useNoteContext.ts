import { NoteContext } from "../context/NoteContext";
import { createContextHook } from "./createContextHook";

export const useNoteContext = createContextHook(NoteContext, "useNoteContext");
