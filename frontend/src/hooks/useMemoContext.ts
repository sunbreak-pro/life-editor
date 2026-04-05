import { MemoContext } from "../context/MemoContextValue";
import { createContextHook } from "./createContextHook";

export const useMemoContext = createContextHook(MemoContext, "useMemoContext");
