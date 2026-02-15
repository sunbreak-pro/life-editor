import { MemoContext } from "../context/MemoContext";
import { createContextHook } from "./createContextHook";

export const useMemoContext = createContextHook(MemoContext, "useMemoContext");
