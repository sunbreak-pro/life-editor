import { WikiTagContext } from "../context/WikiTagContextValue";
import { createOptionalContextHook } from "./createOptionalContextHook";

export const useWikiTagsOptional = createOptionalContextHook(WikiTagContext);
