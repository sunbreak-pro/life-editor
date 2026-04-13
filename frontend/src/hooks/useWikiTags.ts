import { WikiTagContext } from "../context/WikiTagContextValue";
import { createContextHook } from "./createContextHook";

export const useWikiTags = createContextHook(WikiTagContext, "useWikiTags");
